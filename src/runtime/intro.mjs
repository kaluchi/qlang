// Reflective built-ins — operands that live on the state level
// instead of the value level.
//
// `env`, `use`, `reify`, and `manifest` read or write the full
// state pair, so they are built with `stateOp` / `stateOpVariadic`
// (raw state transformers, no pipeValue extraction or result
// wrapping). Semantically they are ordinary entries in langRuntime;
// syntactically they are ordinary identifiers. They can be shadowed
// by `let` or `as` like any other name — the "reflectiveness" is
// a property of the value bound to the name, not of the grammar.

import { stateOp, stateOpVariadic, UNBOUNDED } from './dispatch.mjs';
import { makeState, withPipeValue, envMerge, envGet, envHas } from '../state.mjs';
import {
  isQMap, isFunctionValue, isThunk, isSnapshot, isKeyword,
  isVec, isQSet, isNumber, isString, isBoolean, isNil,
  describeType, keyword
} from '../types.mjs';
import { declareSubjectError, declareShapeError } from './operand-errors.mjs';
import {
  UnresolvedIdentifierError,
  ArityError,
  QlangTypeError
} from '../errors.mjs';

const UseSubjectNotMap = declareSubjectError('UseSubjectNotMap', 'use', 'Map');
const ReifyKeyNotKeyword = declareShapeError('ReifyKeyNotKeyword',
  ({ actualType }) => `reify(:name) requires a keyword captured arg, got ${actualType}`);

// env — replaces pipeValue with the current env Map. Inside a
// fork, returns the fork's current env (including any local `as`
// or `let` writes visible at this point).
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, state.env), {
  category: 'reflective',
  subject: 'irrelevant (ignores pipeValue)',
  modifiers: [],
  returns: 'Map (the current env)',
  docs: ['Replaces pipeValue with the current env Map. Inside a fork, returns the fork-local env including any as/let writes visible at this point.'],
  examples: ['env | keys', 'env | has(:count)', 'env | /myBinding'],
  throws: []
});

// use — merges the current pipeValue (a Map) into env. Returns
// a new state with the enlarged env; pipeValue is unchanged so
// the caller can chain further. Inside a paren-group / Vec /
// Map / Set fork the merged bindings evaporate when the fork
// closes, matching the documented fork rule.
export const use = stateOp('use', 1, (state, _lambdas) => {
  if (!isQMap(state.pipeValue)) {
    throw new UseSubjectNotMap(describeType(state.pipeValue), state.pipeValue);
  }
  return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
}, {
  category: 'reflective',
  subject: 'Map',
  modifiers: [],
  returns: 'Map (unchanged pipeValue)',
  docs: ['Merges pipeValue (a Map) into env. Returns a state with the enlarged env; pipeValue is unchanged so the merged Map can be chained further or discarded. On key conflict, the incoming Map wins. Inside a fork, the merged bindings evaporate when the fork closes.'],
  examples: ['{:pi 3.14 :e 2.71} | use | [pi, e]'],
  throws: ['UseSubjectNotMap']
});

// ── reify and manifest ─────────────────────────────────────────
//
// reify is overloaded:
//   reify              (0 captured args) — value-level: descriptor
//                      built from the current pipeValue.
//   reify(:name)       (1 captured keyword) — looks up :name in env
//                      and builds a descriptor with :name attached.
//
// Internal helper: build a descriptor Map from any value. The
// descriptor's :kind field encodes the value's provenance.

function describeValueType(v) {
  if (isNil(v)) return keyword('nil');
  if (isBoolean(v)) return keyword('boolean');
  if (isNumber(v)) return keyword('number');
  if (isString(v)) return keyword('string');
  if (isKeyword(v)) return keyword('keyword');
  if (isVec(v)) return keyword('vec');
  if (isQMap(v)) return keyword('map');
  if (isQSet(v)) return keyword('set');
  return keyword('unknown');
}

function metaToVec(arr) {
  // Defensive copy: meta arrays are frozen but we want to expose
  // them as plain Vecs to user code, which expects mutable-looking
  // (but actually frozen by language semantics) arrays.
  return arr ? [...arr] : [];
}

function buildBuiltinDescriptor(fn, explicitName) {
  const meta = fn.meta || {};
  const result = new Map();
  result.set(keyword('kind'), keyword('builtin'));
  result.set(keyword('name'), explicitName ?? fn.name);
  result.set(keyword('category'), meta.category ? keyword(meta.category) : null);
  result.set(keyword('subject'), meta.subject ?? null);
  result.set(keyword('modifiers'), metaToVec(meta.modifiers));
  result.set(keyword('returns'), meta.returns ?? null);
  // :captured is a 2-element Vec [min, max] describing the
  // acceptable captured-arg count range. The upper bound is the
  // :unbounded keyword for variadic operands and a number for
  // fixed/overloaded ones. Always present — every operand either
  // has captured auto-injected by its dispatch helper or supplies
  // it explicitly in meta.
  result.set(keyword('captured'), metaToVec(meta.captured));
  result.set(keyword('docs'), metaToVec(meta.docs));
  result.set(keyword('examples'), metaToVec(meta.examples));
  result.set(keyword('throws'), metaToVec(meta.throws));
  // :effectful surfaces the @-marker convention from the function
  // value's precomputed flag (set by makeFn → classifyEffect at
  // registration time). Editor hover and runtime catalog inspection
  // both consult this field; the runtime call-site safety net in
  // evalOperandCall reads the same precomputed boolean directly off
  // the function value, not via the descriptor.
  result.set(keyword('effectful'), fn.effectful);
  return result;
}

function buildThunkDescriptor(thunk, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('thunk'));
  result.set(keyword('name'), explicitName ?? thunk.name ?? null);
  result.set(keyword('source'), nodeSource(thunk.expr));
  result.set(keyword('docs'), metaToVec(thunk.docs));
  // :effectful surfaces the @-marker convention from the binding
  // name (`let @foo = ...` → true, `let foo = ...` → false). Set by
  // makeThunk via classifyEffect at evalLetStep time.
  result.set(keyword('effectful'), thunk.effectful);
  // :location carries the source position of the originating
  // LetStep so editor goto-definition can answer "where is `foo`
  // declared?" via reify(:foo) | /location.
  result.set(keyword('location'), thunk.location);
  return result;
}

// nodeSource(node) — returns the original source text of an AST
// node, preferring the parser-captured `text` field (set by
// grammar.peggy::node() for every node that came from a parsed
// source) and falling back to the structural pretty-printer
// `sourceOfAst` for synthesized nodes that have no `text` (e.g.,
// AST built programmatically by codegen, or AST sliced out of a
// serialized session payload that lost its source).
function nodeSource(node) {
  if (node && typeof node === 'object' && typeof node.text === 'string') {
    return node.text;
  }
  return sourceOfAst(node);
}

function buildSnapshotDescriptor(snap, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('snapshot'));
  result.set(keyword('name'), explicitName ?? snap.name ?? null);
  result.set(keyword('value'), snap.value);
  result.set(keyword('type'), describeValueType(snap.value));
  result.set(keyword('docs'), metaToVec(snap.docs));
  // :effectful surfaces the @-marker convention from the binding
  // name (`as @captured` → true, `as captured` → false). Set by
  // makeSnapshot via classifyEffect at evalAsStep time. Mirrors
  // the thunk descriptor field for parallel introspection.
  result.set(keyword('effectful'), snap.effectful);
  // :location carries the source position of the originating
  // AsStep so editor goto-definition reaches the capture site.
  result.set(keyword('location'), snap.location);
  return result;
}

function buildValueDescriptor(value, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('value'));
  // :name is unconditional across all four descriptor builders so
  // consumers walking `manifest * /name` get a uniform field shape.
  // Raw values reached via the value-level reify form (`42 | reify`)
  // carry no binding name and surface :name as null.
  result.set(keyword('name'), explicitName ?? null);
  result.set(keyword('value'), value);
  result.set(keyword('type'), describeValueType(value));
  return result;
}

function describeBinding(value, explicitName) {
  if (isFunctionValue(value)) return buildBuiltinDescriptor(value, explicitName);
  if (isThunk(value)) return buildThunkDescriptor(value, explicitName);
  if (isSnapshot(value)) return buildSnapshotDescriptor(value, explicitName);
  return buildValueDescriptor(value, explicitName);
}

// Best-effort textual rendering of an AST sub-tree. Used for the
// :source field of a thunk descriptor. Not a full pretty-printer —
// covers the common Primary node types and falls back to a node
// type marker for the rest.
function sourceOfAst(node) {
  if (node == null) return null;
  switch (node.type) {
    case 'NumberLit':  return String(node.value);
    case 'StringLit':  return JSON.stringify(node.value);
    case 'BooleanLit': return node.value ? 'true' : 'false';
    case 'NilLit':     return 'nil';
    case 'Keyword':    return ':' + node.name;
    case 'Projection': return '/' + node.keys.join('/');
    case 'OperandCall': {
      if (node.args === null) return node.name;
      const argText = node.args.map(sourceOfAst).join(', ');
      return `${node.name}(${argText})`;
    }
    case 'ParenGroup': return `(${sourceOfAst(node.pipeline)})`;
    case 'VecLit':     return `[${node.elements.map(sourceOfAst).join(' ')}]`;
    case 'SetLit':     return `#{${node.elements.map(sourceOfAst).join(' ')}}`;
    case 'MapLit':     return `{${node.entries.map(e => `:${e.key.name} ${sourceOfAst(e.value)}`).join(' ')}}`;
    case 'Pipeline': {
      const first = sourceOfAst(node.steps[0]);
      const rest = node.steps.slice(1).map(s => `${s.combinator} ${sourceOfAst(s.step)}`).join(' ');
      return `${first} ${rest}`.trim();
    }
    case 'LetStep':    return `let ${node.name} = ${sourceOfAst(node.body)}`;
    case 'AsStep':     return `as ${node.name}`;
    default:           return `<${node.type}>`;
  }
}

// reify — value-level (0 captured) or named-form (1 captured keyword).
export const reify = stateOpVariadic('reify', 2, (state, lambdas) => {
  if (lambdas.length === 0) {
    // Value-level: describe state.pipeValue
    const descriptor = describeBinding(state.pipeValue);
    return withPipeValue(state, descriptor);
  }
  if (lambdas.length === 1) {
    // Named form: lookup :name in env, attach :name field
    const keyValue = lambdas[0](state.pipeValue);
    if (!isKeyword(keyValue)) {
      throw new ReifyKeyNotKeyword({ actualType: describeType(keyValue), actualValue: keyValue });
    }
    if (!state.env.has(keyValue)) {
      throw new UnresolvedIdentifierError(keyValue.name);
    }
    const bound = state.env.get(keyValue);
    const descriptor = describeBinding(bound, keyValue.name);
    return withPipeValue(state, descriptor);
  }
  throw new ArityError(`reify accepts 0 or 1 captured args, got ${lambdas.length}`);
}, {
  category: 'reflective',
  subject: 'any (value-level form) or env keyword (named form)',
  modifiers: ['keyword (optional, named form)'],
  returns: 'Map (descriptor)',
  captured: [0, 1],
  docs: ['Builds a descriptor Map for a value. Value-level form (no captured args) describes the current pipeValue. Named form reify(:name) looks up :name in env and describes whatever binding lives there. Descriptor :kind is one of :builtin, :thunk, :snapshot, :value.'],
  examples: ['env | /count | reify', 'reify(:filter)', '42 | reify'],
  throws: ['ReifyKeyNotKeyword', 'UnresolvedIdentifierError']
});

// manifest — Vec of descriptors, one per binding in env, sorted by name.
export const manifest = stateOp('manifest', 1, (state, _lambdas) => {
  const entries = [];
  for (const [k, v] of state.env) {
    if (isKeyword(k)) {
      entries.push({ name: k.name, key: k, value: v });
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const descriptors = entries.map(e => describeBinding(e.value, e.name));
  return withPipeValue(state, descriptors);
}, {
  category: 'reflective',
  subject: 'irrelevant (ignores pipeValue)',
  modifiers: [],
  returns: 'Vec of Map descriptors',
  docs: ['Iterates the current env and returns a Vec of descriptors (one per binding) sorted alphabetically by binding name. Each descriptor has the same shape as reify(:name) for that binding.'],
  examples: ['env | manifest | filter(/kind | eq(:builtin)) | table'],
  throws: []
});

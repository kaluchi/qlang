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
import { deepEqual } from '../equality.mjs';
// Live ESM binding into eval.mjs — runtime/index.mjs → intro.mjs →
// eval.mjs → runtime/index.mjs forms a cycle; we never touch
// evalQuery at module-init time, only from inside the runExamples
// closure which is called long after every module has finished
// loading, so the binding resolves correctly.
import { evalQuery } from '../eval.mjs';

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

// Bare-ident pattern shadowing the grammar.peggy production
// `Ident = [@_a-zA-Z] [a-zA-Z0-9_-]*` minus reserved words. A name
// that satisfies isBareIdent can be rendered as `:name` and `/name`;
// anything else needs the quoted form `:"…"` / `/"…"`. The grammar's
// reserved-word set is replicated here so a synthesized Keyword node
// whose .name happens to be `let`/`as`/`true`/`false`/`nil` is also
// rendered with quotes.
const RESERVED_IDENT_NAMES = new Set(['let', 'as', 'true', 'false', 'nil']);
const BARE_IDENT_RE = /^[@_a-zA-Z][a-zA-Z0-9_-]*$/;

function isBareIdent(name) {
  return typeof name === 'string'
      && BARE_IDENT_RE.test(name)
      && !RESERVED_IDENT_NAMES.has(name);
}

// renderKeywordToken('foo') → ':foo'
// renderKeywordToken('foo bar') → ':"foo bar"'
// renderKeywordToken('') → ':""'
function renderKeywordToken(name) {
  return isBareIdent(name) ? ':' + name : ':' + JSON.stringify(name);
}

// renderProjectionSegmentToken('foo') → 'foo'
// renderProjectionSegmentToken('foo bar') → '"foo bar"'
function renderProjectionSegmentToken(name) {
  return isBareIdent(name) ? name : JSON.stringify(name);
}

// Structural rendering of an AST sub-tree as parseable qlang source.
// Used by `nodeSource` as the fallback path when an AST node has no
// parser-captured `.text` field — that is, for synthesized AST built
// programmatically (codegen) or AST sliced out of a serialized session
// payload that lost its source. The rendering is the structural inverse
// of parse over the Primary subtree: for every supported node type the
// produced string parses back into a structurally-equivalent AST.
//
// Quoted-form rendering for Keyword, Projection segments, and Map
// entry keys honors the grammar's bare-ident restriction: names that
// match the bare-ident pattern emit as `:name`/`/name`, anything else
// emits as `:"…"`/`/"…"` with full escape support via JSON.stringify.
//
// MapLit delegates to the MapEntry case so the quoted-key logic lives
// in exactly one place. Pipeline rendering preserves combinators and
// the first-step bare convention.
function sourceOfAst(node) {
  if (node == null) return null;
  switch (node.type) {
    case 'NumberLit':  return String(node.value);
    case 'StringLit':  return JSON.stringify(node.value);
    case 'BooleanLit': return node.value ? 'true' : 'false';
    case 'NilLit':     return 'nil';
    case 'Keyword':    return renderKeywordToken(node.name);
    case 'Projection': return '/' + node.keys.map(renderProjectionSegmentToken).join('/');
    case 'OperandCall': {
      if (node.args === null) return node.name;
      const argText = node.args.map(sourceOfAst).join(', ');
      return `${node.name}(${argText})`;
    }
    case 'ParenGroup': return `(${sourceOfAst(node.pipeline)})`;
    case 'VecLit':     return `[${node.elements.map(sourceOfAst).join(' ')}]`;
    case 'SetLit':     return `#{${node.elements.map(sourceOfAst).join(' ')}}`;
    case 'MapEntry':   return `${sourceOfAst(node.key)} ${sourceOfAst(node.value)}`;
    case 'MapLit':     return `{${node.entries.map(sourceOfAst).join(' ')}}`;
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

const RunExamplesSubjectNotDescriptor = declareSubjectError(
  'RunExamplesSubjectNotDescriptor', 'runExamples', 'descriptor Map'
);
const RunExamplesNoExamplesField = declareShapeError('RunExamplesNoExamplesField',
  ({ subjectKind }) => `runExamples requires the subject descriptor to carry an :examples Vec, got descriptor of kind ${subjectKind}`);

// runExamples — homoiconic catalog self-test. Takes a descriptor
// Map (the output of `reify`) as the subject, parses every entry of
// its :examples Vec as a qlang query, evaluates it, and returns a
// Vec of result Maps. Each result Map carries:
//
//   :query    — the source string of the example, with the optional
//               `→ expected` suffix stripped
//   :expected — the source string after `→`, or nil if absent
//   :actual   — the value the query evaluated to (or nil on error)
//   :error    — the error message string, or nil on success
//   :ok       — true iff the query evaluated AND, when an `→ expected`
//               clause was present, the actual matched the expected
//               via deepEqual
//
// The split character is the Unicode arrow `→` (U+2192) which the
// catalog uses by convention as the example/result separator. An
// example without `→` is a demonstration: `:ok` means it parsed and
// evaluated without throwing, with no further check on the result.
//
// Use this to defend the operand catalog against doc drift: a
// conformance case `manifest * runExamples >> /ok | distinct` should
// always equal `[true]`.
const ARROW = '→';

function buildExampleResult(querySrc, expectedSrc) {
  const result = new Map();
  result.set(keyword('query'), querySrc);
  result.set(keyword('expected'), expectedSrc);
  let actual;
  try {
    actual = evalQuery(querySrc);
  } catch (e) {
    result.set(keyword('actual'), null);
    result.set(keyword('error'), e.message);
    result.set(keyword('ok'), false);
    return result;
  }
  result.set(keyword('actual'), actual);
  if (expectedSrc === null) {
    result.set(keyword('error'), null);
    result.set(keyword('ok'), true);
    return result;
  }
  let expected;
  try {
    expected = evalQuery(expectedSrc);
  } catch (e) {
    result.set(keyword('error'), 'expected: ' + e.message);
    result.set(keyword('ok'), false);
    return result;
  }
  result.set(keyword('error'), null);
  result.set(keyword('ok'), deepEqual(actual, expected));
  return result;
}

export const runExamples = stateOp('runExamples', 1, (state, _lambdas) => {
  const subject = state.pipeValue;
  if (!isQMap(subject)) {
    throw new RunExamplesSubjectNotDescriptor(describeType(subject), subject);
  }
  const examples = subject.get(keyword('examples'));
  if (!isVec(examples)) {
    const subjectKind = subject.get(keyword('kind'));
    throw new RunExamplesNoExamplesField({
      subjectKind: isKeyword(subjectKind) ? subjectKind.name : 'unknown'
    });
  }
  const results = examples.map((example) => {
    if (typeof example !== 'string') {
      const result = new Map();
      result.set(keyword('query'), null);
      result.set(keyword('expected'), null);
      result.set(keyword('actual'), null);
      result.set(keyword('error'), 'example entry is not a string');
      result.set(keyword('ok'), false);
      return result;
    }
    const arrowAt = example.indexOf(ARROW);
    const querySrc = arrowAt >= 0 ? example.substring(0, arrowAt).trim() : example.trim();
    const expectedSrc = arrowAt >= 0 ? example.substring(arrowAt + ARROW.length).trim() : null;
    return buildExampleResult(querySrc, expectedSrc);
  });
  return withPipeValue(state, results);
}, {
  category: 'reflective',
  subject: 'descriptor Map (the output of reify)',
  modifiers: [],
  returns: 'Vec of result Maps {:query :expected :actual :error :ok}',
  docs: ['Parses and evaluates every entry of the descriptor\'s :examples Vec, comparing each result against the optional `→ expected` suffix. Returns a Vec of {:query :expected :actual :error :ok} Maps. The composition `manifest * runExamples >> /ok | distinct` exercises every catalog example and reports whether the documented examples still match their actual evaluation results — homoiconic doc drift detection.'],
  examples: ['reify(:count) | runExamples', 'manifest * runExamples >> /ok | distinct'],
  throws: ['RunExamplesSubjectNotDescriptor', 'RunExamplesNoExamplesField']
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

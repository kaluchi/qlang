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
//
// Meta lives in manifest.qlang.

import { stateOp, stateOpVariadic, UNBOUNDED } from './dispatch.mjs';
import { makeState, withPipeValue, envMerge, envGet, envHas } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword,
  isVec, isQSet, isNumber, isString, isBoolean, isNil,
  describeType, keyword, makeConduit, makeSnapshot, isErrorValue
} from '../types.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { errorFromQlang } from '../error-convert.mjs';
import {
  UnresolvedIdentifierError,
  QlangTypeError,
  EffectLaunderingAtLetParse
} from '../errors.mjs';
import { findFirstEffectfulIdentifier } from '../effect-check.mjs';
import { classifyEffect } from '../effect.mjs';
import { deepEqual } from '../equality.mjs';
// Live ESM binding into eval.mjs — runtime/index.mjs → intro.mjs →
// eval.mjs → runtime/index.mjs forms a cycle; we never touch
// evalQuery at module-init time, only from inside the runExamples
// closure which is called long after every module has finished
// loading, so the binding resolves correctly.
import { evalQuery } from '../eval.mjs';
import { parse as parseSource } from '../parse.mjs';

const UseSubjectNotMap = declareSubjectError('UseSubjectNotMap', 'use', 'Map');
const UseNamespaceNotKeyword = declareShapeError('UseNamespaceNotKeyword',
  ({ actualType }) => `use(:namespace) requires a keyword, got ${actualType}`);
const UseNamespaceNotFound = declareShapeError('UseNamespaceNotFound',
  ({ namespaceName }) => `use: namespace '${namespaceName}' not found in env`);
const UseNamespaceNotMap = declareShapeError('UseNamespaceNotMap',
  ({ namespaceName, actualType }) => `use: namespace '${namespaceName}' is ${actualType}, expected Map`);
const UseNamespaceElementNotKeyword = declareShapeError('UseNamespaceElementNotKeyword',
  ({ index, actualType }) => `use: element ${index} of namespace list must be a keyword, got ${actualType}`);
const UseNamespaceCollision = declareShapeError('UseNamespaceCollision',
  ({ collidingName, namespaces }) => `use: name '${collidingName}' exported by multiple namespaces: ${namespaces.join(', ')}`);
const UseNameNotExported = declareShapeError('UseNameNotExported',
  ({ namespaceName, exportName }) => `use: '${exportName}' not exported by namespace '${namespaceName}'`);
const ReifyArityOverflow = declareArityError('ReifyArityOverflow',
  ({ actualArity }) => `reify accepts 0 or 1 captured args, got ${actualArity}`);
const ReifyKeyNotKeyword = declareShapeError('ReifyKeyNotKeyword',
  ({ actualType }) => `reify(:name) requires a keyword captured arg, got ${actualType}`);

// env — replaces pipeValue with the current env Map.
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, state.env));

// use — overloaded by arity:
//   0 captured: merge pipeValue Map into env (existing)
//   1 captured: namespace import (keyword, Vec, or Set)
//   2 captured: selective namespace import (keyword + filter Set/Vec)
export const use = stateOpVariadic('use', 3, (state, lambdas) => {
  if (lambdas.length === 0) {
    // Existing: merge pipeValue Map into env
    if (!isQMap(state.pipeValue)) {
      throw new UseSubjectNotMap(describeType(state.pipeValue), state.pipeValue);
    }
    return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
  }

  const arg = lambdas[0](state.pipeValue);

  if (lambdas.length === 1) {
    // Single arg — dispatch by type
    if (isKeyword(arg))  return importSingleNamespace(state, arg);
    if (isVec(arg))      return importOrderedNamespaces(state, arg);
    if (isQSet(arg))     return importUnorderedNamespaces(state, arg);
    throw new UseNamespaceNotKeyword({ actualType: describeType(arg), actualValue: arg });
  }

  // Two args: namespace keyword + selection filter
  if (!isKeyword(arg)) {
    throw new UseNamespaceNotKeyword({ actualType: describeType(arg), actualValue: arg });
  }
  const selection = lambdas[1](state.pipeValue);
  return importSelectiveNamespace(state, arg, selection);
}, [0, 2]);

function resolveNamespaceEnv(outerEnv, nsKeyword) {
  if (!outerEnv.has(nsKeyword)) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }
  const moduleEnv = outerEnv.get(nsKeyword);
  if (!isQMap(moduleEnv)) {
    throw new UseNamespaceNotMap({
      namespaceName: nsKeyword.name,
      actualType: describeType(moduleEnv)
    });
  }
  return moduleEnv;
}

function importSingleNamespace(state, nsKeyword) {
  const moduleEnv = resolveNamespaceEnv(state.env, nsKeyword);
  return makeState(state.pipeValue, envMerge(state.env, moduleEnv));
}

function importOrderedNamespaces(state, namespaces) {
  let currentEnv = state.env;
  for (let i = 0; i < namespaces.length; i++) {
    const ns = namespaces[i];
    if (!isKeyword(ns)) {
      throw new UseNamespaceElementNotKeyword({ index: i, actualType: describeType(ns) });
    }
    const moduleEnv = resolveNamespaceEnv(currentEnv, ns);
    currentEnv = envMerge(currentEnv, moduleEnv);
  }
  return makeState(state.pipeValue, currentEnv);
}

function importUnorderedNamespaces(state, namespaces) {
  const merged = new Map();
  const origins = new Map();
  for (const ns of namespaces) {
    const moduleEnv = resolveNamespaceEnv(state.env, ns);
    for (const [k, v] of moduleEnv) {
      if (merged.has(k)) {
        throw new UseNamespaceCollision({
          collidingName: isKeyword(k) ? k.name : String(k),
          namespaces: [origins.get(k), ns.name]
        });
      }
      merged.set(k, v);
      origins.set(k, ns.name);
    }
  }
  return makeState(state.pipeValue, envMerge(state.env, merged));
}

function importSelectiveNamespace(state, nsKeyword, selection) {
  const moduleEnv = resolveNamespaceEnv(state.env, nsKeyword);
  const names = isQSet(selection) ? [...selection] : isVec(selection) ? selection : [selection];
  const filtered = new Map();
  for (const name of names) {
    if (!moduleEnv.has(name)) {
      throw new UseNameNotExported({
        namespaceName: nsKeyword.name,
        exportName: isKeyword(name) ? name.name : String(name)
      });
    }
    filtered.set(name, moduleEnv.get(name));
  }
  return makeState(state.pipeValue, envMerge(state.env, filtered));
}

// ── reify and manifest ─────────────────────────────────────────

function describeValueType(v) {
  if (isNil(v)) return keyword('nil');
  if (isBoolean(v)) return keyword('boolean');
  if (isNumber(v)) return keyword('number');
  if (isString(v)) return keyword('string');
  if (isKeyword(v)) return keyword('keyword');
  if (isVec(v)) return keyword('vec');
  if (isQMap(v)) return keyword('map');
  if (isQSet(v)) return keyword('set');
  if (isErrorValue(v)) return keyword('error');
  return keyword('unknown');
}

// Descriptor field helpers — extracted so each null-fallback
// path is testable via synthetic conduits/snapshots/functions.
export function metaToVec(arr) {
  return arr ? [...arr] : [];
}

export function bindingName(explicitName, binding) {
  if (explicitName != null) return explicitName;
  if (binding && binding.name != null) return binding.name;
  return null;
}

export function capturedRange(fn) {
  if (fn.meta && fn.meta.captured != null) return fn.meta.captured;
  return null;
}

export function categoryKeyword(meta) {
  if (meta.category) return keyword(meta.category);
  return null;
}

// Extract message from an error value — runtime errors carry
// .originalError, user-created errors carry :message in descriptor.
export function errorMessageOf(errorValue) {
  if (errorValue.originalError) return errorValue.originalError.message;
  return errorValue.descriptor.get(keyword('message'));
}

function buildBuiltinDescriptor(fn, explicitName) {
  const meta = fn.meta;
  const result = new Map();
  result.set(keyword('kind'), keyword('builtin'));
  result.set(keyword('name'), bindingName(explicitName, fn));
  result.set(keyword('category'), categoryKeyword(meta));
  result.set(keyword('subject'), meta.subject);
  result.set(keyword('modifiers'), metaToVec(meta.modifiers));
  result.set(keyword('returns'), meta.returns);
  result.set(keyword('captured'), metaToVec(capturedRange(fn)));
  result.set(keyword('docs'), metaToVec(meta.docs));
  result.set(keyword('examples'), metaToVec(meta.examples));
  result.set(keyword('throws'), metaToVec(meta.throws));
  result.set(keyword('effectful'), fn.effectful);
  return result;
}

function buildConduitDescriptor(conduit, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('conduit'));
  result.set(keyword('name'), bindingName(explicitName, conduit));
  result.set(keyword('params'), metaToVec(conduit.params));
  result.set(keyword('source'), nodeSource(conduit.body));
  result.set(keyword('docs'), metaToVec(conduit.docs));
  result.set(keyword('effectful'), conduit.effectful);
  result.set(keyword('location'), conduit.location);
  return result;
}

function nodeSource(node) {
  if (node && typeof node === 'object' && typeof node.text === 'string') {
    return node.text;
  }
  return sourceOfAst(node);
}

const RESERVED_IDENT_NAMES = new Set(['true', 'false', 'nil']);
const BARE_IDENT_RE = /^[@_a-zA-Z][a-zA-Z0-9_-]*$/;

function isBareIdent(name) {
  return typeof name === 'string'
      && BARE_IDENT_RE.test(name)
      && !RESERVED_IDENT_NAMES.has(name);
}

function renderKeywordToken(name) {
  return isBareIdent(name) ? ':' + name : ':' + JSON.stringify(name);
}

function renderProjectionSegmentToken(name) {
  return isBareIdent(name) ? name : JSON.stringify(name);
}

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
    case 'ParenGroup':        return `(${sourceOfAst(node.pipeline)})`;
    case 'LinePlainComment':  return `|~| ${node.content}`;
    case 'BlockPlainComment': return `|~${node.content}~|`;
    case 'LineDocComment':    return `|~~| ${node.content}`;
    case 'BlockDocComment':   return `|~~${node.content}~~|`;
    case 'VecLit':     return `[${node.elements.map(sourceOfAst).join(' ')}]`;
    case 'SetLit':     return `#{${node.elements.map(sourceOfAst).join(' ')}}`;
    case 'MapEntry':   return `${sourceOfAst(node.key)} ${sourceOfAst(node.value)}`;
    case 'MapLit':     return `{${node.entries.map(sourceOfAst).join(' ')}}`;
    case 'ErrorLit':   return `!{${node.entries.map(sourceOfAst).join(' ')}}`;
    case 'Pipeline': {
      const prefix = node.leadingFail ? '!| ' : '';
      const first = sourceOfAst(node.steps[0]);
      const rest = node.steps.slice(1).map(s => `${s.combinator} ${sourceOfAst(s.step)}`).join(' ');
      return `${prefix}${first} ${rest}`.trim();
    }
    default:           return `<${node.type}>`;
  }
}

function buildSnapshotDescriptor(snap, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('snapshot'));
  result.set(keyword('name'), bindingName(explicitName, snap));
  result.set(keyword('value'), snap.value);
  result.set(keyword('type'), describeValueType(snap.value));
  result.set(keyword('docs'), metaToVec(snap.docs));
  result.set(keyword('effectful'), snap.effectful);
  result.set(keyword('location'), snap.location);
  return result;
}

function buildValueDescriptor(value, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('value'));
  result.set(keyword('name'), explicitName ?? null);
  result.set(keyword('value'), value);
  result.set(keyword('type'), describeValueType(value));
  return result;
}

function describeBinding(value, explicitName) {
  if (isFunctionValue(value)) return buildBuiltinDescriptor(value, explicitName);
  if (isConduit(value)) return buildConduitDescriptor(value, explicitName);
  if (isSnapshot(value)) return buildSnapshotDescriptor(value, explicitName);
  return buildValueDescriptor(value, explicitName);
}

// reify — value-level (0 captured) or named-form (1 captured keyword).
export const reify = stateOpVariadic('reify', 2, (state, lambdas) => {
  if (lambdas.length === 0) {
    const descriptor = describeBinding(state.pipeValue);
    return withPipeValue(state, descriptor);
  }
  if (lambdas.length === 1) {
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
  throw new ReifyArityOverflow({ actualArity: lambdas.length });
}, [0, 1]);

const RunExamplesSubjectNotDescriptor = declareSubjectError(
  'RunExamplesSubjectNotDescriptor', 'runExamples', 'descriptor Map'
);
const RunExamplesNoExamplesField = declareShapeError('RunExamplesNoExamplesField',
  ({ subjectKind }) => `runExamples requires the subject descriptor to carry an :examples Vec, got descriptor of kind ${subjectKind}`);

// runExampleEntry(example) → result Map
//
// Each example is a Map with :doc (optional), :snippet, :expected
// (optional). Two modes:
//
//   Assertion mode — when :expected is a string: evalQuery both the
//   snippet and the expected, deepEqual-compare the two values.
//   `:ok` is true iff both eval cleanly AND the values match.
//
//   Demo mode — when :expected is absent: only parse-verify the
//   snippet. Demo examples illustrate call-site style using
//   caller-supplied bindings (`person | coalesce(/preferredName,
//   …)`), which cannot be evalQuery'd in runExamples' isolated env
//   because those bindings are not installed. Running them would
//   mark every demo example as failing for the wrong reason, so
//   demo mode stops at parse and marks `:ok` true if the snippet
//   is syntactically valid.
function runExampleEntry(example) {
  const result = new Map();
  const snippetSrc = isQMap(example) ? example.get(keyword('snippet')) : null;
  const expectedSrc = isQMap(example) ? example.get(keyword('expected')) : null;
  const doc = isQMap(example) ? example.get(keyword('doc')) : null;

  result.set(keyword('snippet'), snippetSrc);
  result.set(keyword('doc'), doc);
  result.set(keyword('expected'), expectedSrc);

  if (typeof snippetSrc !== 'string') {
    result.set(keyword('actual'), null);
    result.set(keyword('error'), 'example :snippet must be a string');
    result.set(keyword('ok'), false);
    return result;
  }

  if (typeof expectedSrc !== 'string') {
    // Demo mode — parse-verify only, no eval.
    try {
      parseSource(snippetSrc);
    } catch (e) {
      result.set(keyword('actual'), null);
      result.set(keyword('error'), e.message);
      result.set(keyword('ok'), false);
      return result;
    }
    result.set(keyword('actual'), null);
    result.set(keyword('error'), null);
    result.set(keyword('ok'), true);
    return result;
  }

  // Assertion mode — both snippet and expected are eval'd and compared.
  const actual = evalQuery(snippetSrc);
  if (isErrorValue(actual)) {
    result.set(keyword('actual'), null);
    result.set(keyword('error'), errorMessageOf(actual));
    result.set(keyword('ok'), false);
    return result;
  }
  result.set(keyword('actual'), actual);

  const expected = evalQuery(expectedSrc);
  if (isErrorValue(expected)) {
    result.set(keyword('error'), 'expected: ' + errorMessageOf(expected));
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
  return withPipeValue(state, examples.map(runExampleEntry));
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
});

// ── let and as — binding operands ─────────────────────────────

const LetNameNotKeyword = declareShapeError('LetNameNotKeyword',
  ({ actualType }) => `let requires a keyword as its first argument (the binding name), got ${actualType}`);
const LetParamsNotVecOfKeywords = declareShapeError('LetParamsNotVecOfKeywords',
  ({ index, actualType }) => `let parameter list must be a Vec of keywords; element ${index} is ${actualType}`);
const LetBodyMissing = declareArityError('LetBodyMissing',
  ({ actualCount }) => `let requires 2 arguments (name, body) or 3 arguments (name, params, body), got ${actualCount}`);
const AsNameNotKeyword = declareShapeError('AsNameNotKeyword',
  ({ actualType }) => `as requires a keyword argument (the binding name), got ${actualType}`);

import { envSet } from '../state.mjs';

export const letOperand = stateOpVariadic('let', 16, (state, lambdas) => {
  const argCount = lambdas.length;
  if (argCount < 2 || argCount > 3) {
    throw new LetBodyMissing({ actualCount: argCount });
  }

  const nameValue = lambdas[0](state.pipeValue);
  if (!isKeyword(nameValue)) {
    throw new LetNameNotKeyword({ actualType: describeType(nameValue), actualValue: nameValue });
  }
  const bindingName = nameValue.name;

  let params = [];
  let bodyLambda;
  if (argCount === 3) {
    const paramsValue = lambdas[1](state.pipeValue);
    if (!isVec(paramsValue)) {
      throw new LetParamsNotVecOfKeywords({ index: -1, actualType: describeType(paramsValue), actualValue: paramsValue });
    }
    for (let i = 0; i < paramsValue.length; i++) {
      if (!isKeyword(paramsValue[i])) {
        throw new LetParamsNotVecOfKeywords({ index: i, actualType: describeType(paramsValue[i]), actualValue: paramsValue[i] });
      }
    }
    params = paramsValue.map(k => k.name);
    bodyLambda = lambdas[2];
  } else {
    bodyLambda = lambdas[1];
  }

  const bodyAst = bodyLambda.astNode;

  if (!classifyEffect(bindingName) && bodyAst) {
    const offender = findFirstEffectfulIdentifier(bodyAst);
    if (offender !== null) {
      throw new EffectLaunderingAtLetParse({
        letName: bindingName,
        effectfulName: offender,
        location: bodyAst.location
      });
    }
  }

  const envRef = { env: null };
  const conduit = makeConduit(bodyAst, {
    name: bindingName,
    params,
    envRef,
    docs: lambdas.docs,
    location: bodyAst.location
  });
  const nextEnv = envSet(state.env, bindingName, conduit);
  envRef.env = nextEnv;
  return makeState(state.pipeValue, nextEnv);
}, [2, 3]);

// as(:name) — snapshot the current pipeValue under a keyword name.
export const asOperand = stateOp('as', 2, (state, lambdas) => {
  const nameValue = lambdas[0](state.pipeValue);
  if (!isKeyword(nameValue)) {
    throw new AsNameNotKeyword({ actualType: describeType(nameValue), actualValue: nameValue });
  }
  const bindingName = nameValue.name;
  const snapshot = makeSnapshot(state.pipeValue, {
    name: bindingName,
    docs: lambdas.docs,
    location: lambdas.location
  });
  const nextEnv = envSet(state.env, bindingName, snapshot);
  return makeState(state.pipeValue, nextEnv);
});

// ── Variant-B primitive registry bindings ─────────────────────
// Bind each reflective operand impl into PRIMITIVE_REGISTRY under
// its :qlang/prim/ namespaced key at module-load time. Note that
// `letOperand` / `asOperand` are the JS-level identifiers for the
// qlang operands `let` / `as` (those names are JS reserved / common
// enough that the JS-side identifier disambiguates); the registry
// keys use the qlang names.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/env'),          env);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/use'),          use);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/reify'),        reify);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/runExamples'), runExamples);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/manifest'),    manifest);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/let'),         letOperand);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/as'),          asOperand);

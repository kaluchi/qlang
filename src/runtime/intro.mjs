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

import { stateOp, stateOpVariadic } from './dispatch.mjs';
import { makeState, withPipeValue, envMerge, envGet, envHas } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword,
  isVec, isQSet, isNumber, isString, isBoolean, isNil,
  describeType, keyword, makeConduit, makeSnapshot
} from '../types.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from './operand-errors.mjs';
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

const UseSubjectNotMap = declareSubjectError('UseSubjectNotMap', 'use', 'Map');
const ReifyArityOverflow = declareArityError('ReifyArityOverflow',
  ({ actualArity }) => `reify accepts 0 or 1 captured args, got ${actualArity}`);
const ReifyKeyNotKeyword = declareShapeError('ReifyKeyNotKeyword',
  ({ actualType }) => `reify(:name) requires a keyword captured arg, got ${actualType}`);

// env — replaces pipeValue with the current env Map.
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, state.env));

// use — merges the current pipeValue (a Map) into env.
export const use = stateOp('use', 1, (state, _lambdas) => {
  if (!isQMap(state.pipeValue)) {
    throw new UseSubjectNotMap(describeType(state.pipeValue), state.pipeValue);
  }
  return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
});

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
  return keyword('unknown');
}

function metaToVec(arr) {
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
  result.set(keyword('captured'), metaToVec(fn.meta?.captured ?? fn.captured));
  result.set(keyword('docs'), metaToVec(meta.docs));
  result.set(keyword('examples'), metaToVec(meta.examples));
  result.set(keyword('throws'), metaToVec(meta.throws));
  result.set(keyword('effectful'), fn.effectful);
  return result;
}

function buildConduitDescriptor(conduit, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('conduit'));
  result.set(keyword('name'), explicitName ?? conduit.name ?? null);
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

function buildSnapshotDescriptor(snap, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('snapshot'));
  result.set(keyword('name'), explicitName ?? snap.name ?? null);
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
    case 'Pipeline': {
      const first = sourceOfAst(node.steps[0]);
      const rest = node.steps.slice(1).map(s => `${s.combinator} ${sourceOfAst(s.step)}`).join(' ');
      return `${first} ${rest}`.trim();
    }
    default:           return `<${node.type}>`;
  }
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
        location: bodyAst.location ?? null
      });
    }
  }

  const docs = lambdas.docs || [];
  const envRef = { env: null };
  const conduit = makeConduit(bodyAst, {
    name: bindingName,
    params,
    envRef,
    docs,
    location: bodyAst?.location ?? null
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
  const docs = lambdas.docs || [];
  const snapshot = makeSnapshot(state.pipeValue, {
    name: bindingName,
    docs,
    location: lambdas.location ?? null
  });
  const nextEnv = envSet(state.env, bindingName, snapshot);
  return makeState(state.pipeValue, nextEnv);
});

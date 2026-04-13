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
// Meta lives in lib/qlang/core.qlang.

import { stateOp, stateOpVariadic, UNBOUNDED } from './dispatch.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { astNodeToMap, qlangMapToAst } from '../walk.mjs';
import { makeState, withPipeValue, envMerge, envGet, envHas } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword,
  isVec, isQSet, isNumber, isString, isBoolean, isNull,
  describeType, keyword, makeConduit, makeSnapshot, isErrorValue
} from '../types.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { errorFromQlang, errorFromParse } from '../error-convert.mjs';
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
import { evalQuery, evalAst } from '../eval.mjs';
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
export const use = stateOpVariadic('use', 3, async (state, useLambdas) => {
  if (useLambdas.length === 0) {
    // Existing: merge pipeValue Map into env
    if (!isQMap(state.pipeValue)) {
      throw new UseSubjectNotMap(describeType(state.pipeValue), state.pipeValue);
    }
    return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
  }

  const useArg = await useLambdas[0](state.pipeValue);

  if (useLambdas.length === 1) {
    // Single arg — dispatch by type
    if (isKeyword(useArg))  return await importSingleNamespace(state, useArg);
    if (isVec(useArg))      return await importOrderedNamespaces(state, useArg);
    if (isQSet(useArg))     return await importUnorderedNamespaces(state, useArg);
    throw new UseNamespaceNotKeyword({ actualType: describeType(useArg), actualValue: useArg });
  }

  // Two args: namespace keyword + selection filter
  if (!isKeyword(useArg)) {
    throw new UseNamespaceNotKeyword({ actualType: describeType(useArg), actualValue: useArg });
  }
  const useSelection = await useLambdas[1](state.pipeValue);
  return await importSelectiveNamespace(state, useArg, useSelection);
}, [0, 2]);

const KW_QLANG_LOCATOR = keyword('qlang/locator');
const KW_QLANG_KIND_BUILTIN = keyword('qlang/kind');
const KW_BUILTIN_TAG = keyword('builtin');
const KW_QLANG_IMPL_FIELD = keyword('qlang/impl');

// resolveNamespaceEnv(outerEnv, nsKeyword) → moduleEnv Map
//
// Looks up the namespace keyword in env. When absent, falls back
// to the host-provided locator (stored under :qlang/locator in
// env by createSession). The locator parses and evals the module
// source, patches :qlang/impl on builtin descriptors with the
// impls from the locator result, and installs the namespace
// keyword in env for subsequent lookups.
//
// Returns [moduleEnv, updatedOuterEnv] — the caller must use
// updatedOuterEnv so the installed namespace persists.
async function resolveNamespaceEnv(outerEnv, nsKeyword) {
  if (outerEnv.has(nsKeyword)) {
    const moduleEnv = outerEnv.get(nsKeyword);
    if (!isQMap(moduleEnv)) {
      throw new UseNamespaceNotMap({
        namespaceName: nsKeyword.name,
        actualType: describeType(moduleEnv)
      });
    }
    return [moduleEnv, outerEnv];
  }

  // Locator fallback: host-provided lazy module loader.
  const locatorFn = outerEnv.get(KW_QLANG_LOCATOR);
  if (!locatorFn) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }
  const locatorResult = await locatorFn(nsKeyword.name);
  if (!locatorResult) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }

  // Parse and eval the module source against the current env so
  // transitive use(:other-ns) inside the module triggers the
  // locator recursively.
  const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
  const moduleEvalState = makeState(outerEnv, outerEnv);
  const moduleResultState = await evalAst(moduleAst, moduleEvalState);

  // Export surface = env delta (bindings the module added).
  const loadedExports = new Map();
  for (const [exportKey, exportVal] of moduleResultState.env) {
    if (!outerEnv.has(exportKey)) {
      loadedExports.set(exportKey, exportVal);
    }
  }

  // Patch :qlang/impl on builtin descriptors with host-provided
  // function values from locatorResult.impls.
  if (locatorResult.impls) {
    for (const [implName, implFn] of Object.entries(locatorResult.impls)) {
      const implKeyword = keyword(implName);
      const implDescriptor = loadedExports.get(implKeyword);
      if (isQMap(implDescriptor)
          && implDescriptor.get(KW_QLANG_KIND_BUILTIN) === KW_BUILTIN_TAG) {
        implDescriptor.set(KW_QLANG_IMPL_FIELD, implFn);
      }
    }
  }

  // Install namespace keyword → exports in env for subsequent lookups.
  let envWithNamespace = new Map(outerEnv);
  envWithNamespace.set(nsKeyword, loadedExports);
  return [loadedExports, envWithNamespace];
}

async function importSingleNamespace(state, nsKeyword) {
  const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state.env, nsKeyword);
  return makeState(state.pipeValue, envMerge(updatedEnv, moduleEnv));
}

async function importOrderedNamespaces(state, namespaces) {
  let currentEnv = state.env;
  for (let i = 0; i < namespaces.length; i++) {
    const ns = namespaces[i];
    if (!isKeyword(ns)) {
      throw new UseNamespaceElementNotKeyword({ index: i, actualType: describeType(ns) });
    }
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(currentEnv, ns);
    currentEnv = envMerge(updatedEnv, moduleEnv);
  }
  return makeState(state.pipeValue, currentEnv);
}

async function importUnorderedNamespaces(state, namespaces) {
  const merged = new Map();
  const origins = new Map();
  for (const ns of namespaces) {
    const [moduleEnv] = await resolveNamespaceEnv(state.env, ns);
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

async function importSelectiveNamespace(state, nsKeyword, selection) {
  const [moduleEnv] = await resolveNamespaceEnv(state.env, nsKeyword);
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
  if (isNull(v)) return keyword('null');
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

// Variant-B descriptor field constants for Map-based reads.
const KW_BODY_FIELD      = keyword('qlang/body');
const KW_VALUE_FIELD     = keyword('qlang/value');
const KW_NAME_FIELD      = keyword('name');
const KW_PARAMS_FIELD    = keyword('params');
const KW_DOCS_FIELD      = keyword('docs');
const KW_EFFECTFUL_FIELD = keyword('effectful');
const KW_LOCATION_FIELD  = keyword('location');

function buildConduitDescriptor(conduit, explicitName) {
  const result = new Map();
  result.set(keyword('kind'), keyword('conduit'));
  result.set(keyword('name'), explicitName ?? conduit.get(KW_NAME_FIELD));
  result.set(keyword('params'), metaToVec(conduit.get(KW_PARAMS_FIELD)));
  // The conduit body is a peggy-parsed AST node, so it carries the
  // original source substring under `.text`. The `:source` field
  // passes that through verbatim — no AST→source rendering.
  result.set(keyword('source'), conduit.get(KW_BODY_FIELD).text);
  result.set(keyword('docs'), metaToVec(conduit.get(KW_DOCS_FIELD)));
  result.set(keyword('effectful'), conduit.get(KW_EFFECTFUL_FIELD));
  result.set(keyword('location'), conduit.get(KW_LOCATION_FIELD));
  return result;
}

function buildSnapshotDescriptor(snap, explicitName) {
  // Value-level reify on a snapshot is unreachable via projection:
  // evalProjection auto-unwraps snapshots to the underlying value
  // before returning, so `env | /someAs | reify` calls buildValueDescriptor
  // on the unwrapped value, not buildSnapshotDescriptor on the wrapper.
  // Every reach into this builder flows through the named form
  // `reify(:name)` or through `manifest`, both of which always pass
  // explicitName. Reading the descriptor's :name field as a fallback
  // would be dead code.
  const value = snap.get(KW_VALUE_FIELD);
  const result = new Map();
  result.set(keyword('kind'), keyword('snapshot'));
  result.set(keyword('name'), explicitName);
  result.set(keyword('value'), value);
  result.set(keyword('type'), describeValueType(value));
  result.set(keyword('docs'), metaToVec(snap.get(KW_DOCS_FIELD)));
  result.set(keyword('effectful'), snap.get(KW_EFFECTFUL_FIELD));
  result.set(keyword('location'), snap.get(KW_LOCATION_FIELD));
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
  // Variant-B built-ins: env stores a descriptor Map directly
  // (authored in lib/qlang/core.qlang, loaded by langRuntime).
  // Reify transforms the raw descriptor into a user-facing shape:
  // internal :qlang/kind and :qlang/impl are stripped; :kind :builtin
  // is stamped; :captured and :effectful are read from the resolved
  // function value sitting on :qlang/impl (placed there by the
  // bootstrap resolution pass in runtime/index.mjs).
  if (isQMap(value) && value.get(keyword('qlang/kind')) === keyword('builtin')) {
    const reifyResult = new Map();
    reifyResult.set(keyword('kind'), keyword('builtin'));
    if (explicitName != null) reifyResult.set(keyword('name'), explicitName);
    for (const [descKey, descVal] of value) {
      const descKeyName = descKey.name;
      if (descKeyName === 'qlang/kind' || descKeyName === 'qlang/impl') continue;
      reifyResult.set(descKey, descVal);
    }
    const implFn = value.get(keyword('qlang/impl'));
    reifyResult.set(keyword('captured'), [...implFn.meta.captured]);
    reifyResult.set(keyword('effectful'), implFn.effectful);
    return reifyResult;
  }
  // Conduit-parameters (created at applyConduit time via makeFn)
  // are function values that can show up as env bindings while a
  // conduit body is evaluating. buildBuiltinDescriptor handles
  // them via the fn.meta path carried by conduit-parameter proxies
  // constructed at makeConduitParameter time, since their metadata
  // is inlined rather than living in core.qlang.
  if (isFunctionValue(value)) return buildBuiltinDescriptor(value, explicitName);
  if (isConduit(value)) return buildConduitDescriptor(value, explicitName);
  if (isSnapshot(value)) return buildSnapshotDescriptor(value, explicitName);
  return buildValueDescriptor(value, explicitName);
}

// reify — value-level (0 captured) or named-form (1 captured keyword).
export const reify = stateOpVariadic('reify', 2, async (state, reifyLambdas) => {
  if (reifyLambdas.length === 0) {
    const reifyDescriptor = describeBinding(state.pipeValue);
    return withPipeValue(state, reifyDescriptor);
  }
  if (reifyLambdas.length === 1) {
    const reifyKeyValue = await reifyLambdas[0](state.pipeValue);
    if (!isKeyword(reifyKeyValue)) {
      throw new ReifyKeyNotKeyword({ actualType: describeType(reifyKeyValue), actualValue: reifyKeyValue });
    }
    if (!state.env.has(reifyKeyValue)) {
      throw new UnresolvedIdentifierError(reifyKeyValue.name);
    }
    const reifyBound = state.env.get(reifyKeyValue);
    const reifyDescriptor = describeBinding(reifyBound, reifyKeyValue.name);
    return withPipeValue(state, reifyDescriptor);
  }
  throw new ReifyArityOverflow({ actualArity: reifyLambdas.length });
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
async function runExampleEntry(exampleMap) {
  const exampleResult = new Map();
  const snippetSrc = isQMap(exampleMap) ? exampleMap.get(keyword('snippet')) : null;
  const expectedSrc = isQMap(exampleMap) ? exampleMap.get(keyword('expected')) : null;
  const exampleDoc = isQMap(exampleMap) ? exampleMap.get(keyword('doc')) : null;

  exampleResult.set(keyword('snippet'), snippetSrc);
  exampleResult.set(keyword('doc'), exampleDoc);
  exampleResult.set(keyword('expected'), expectedSrc);

  if (typeof snippetSrc !== 'string') {
    exampleResult.set(keyword('actual'), null);
    exampleResult.set(keyword('error'), 'example :snippet must be a string');
    exampleResult.set(keyword('ok'), false);
    return exampleResult;
  }

  if (typeof expectedSrc !== 'string') {
    // Demo mode — parse-verify only, no eval.
    try {
      parseSource(snippetSrc);
    } catch (parseVerifyErr) {
      exampleResult.set(keyword('actual'), null);
      exampleResult.set(keyword('error'), parseVerifyErr.message);
      exampleResult.set(keyword('ok'), false);
      return exampleResult;
    }
    exampleResult.set(keyword('actual'), null);
    exampleResult.set(keyword('error'), null);
    exampleResult.set(keyword('ok'), true);
    return exampleResult;
  }

  // Assertion mode — both snippet and expected are eval'd and compared.
  const actualValue = await evalQuery(snippetSrc);
  if (isErrorValue(actualValue)) {
    exampleResult.set(keyword('actual'), null);
    exampleResult.set(keyword('error'), errorMessageOf(actualValue));
    exampleResult.set(keyword('ok'), false);
    return exampleResult;
  }
  exampleResult.set(keyword('actual'), actualValue);

  const expectedValue = await evalQuery(expectedSrc);
  if (isErrorValue(expectedValue)) {
    exampleResult.set(keyword('error'), 'expected: ' + errorMessageOf(expectedValue));
    exampleResult.set(keyword('ok'), false);
    return exampleResult;
  }
  exampleResult.set(keyword('error'), null);
  exampleResult.set(keyword('ok'), deepEqual(actualValue, expectedValue));
  return exampleResult;
}

export const runExamples = stateOp('runExamples', 1, async (state, _runExLambdas) => {
  const runExSubject = state.pipeValue;
  if (!isQMap(runExSubject)) {
    throw new RunExamplesSubjectNotDescriptor(describeType(runExSubject), runExSubject);
  }
  const runExExamples = runExSubject.get(keyword('examples'));
  if (!isVec(runExExamples)) {
    const runExKind = runExSubject.get(keyword('kind'));
    throw new RunExamplesNoExamplesField({
      subjectKind: isKeyword(runExKind) ? runExKind.name : 'unknown'
    });
  }
  const runExResults = await Promise.all(runExExamples.map(runExampleEntry));
  return withPipeValue(state, runExResults);
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

export const letOperand = stateOpVariadic('let', 16, async (state, letLambdas) => {
  const letArgCount = letLambdas.length;
  if (letArgCount < 2 || letArgCount > 3) {
    throw new LetBodyMissing({ actualCount: letArgCount });
  }

  const letNameValue = await letLambdas[0](state.pipeValue);
  if (!isKeyword(letNameValue)) {
    throw new LetNameNotKeyword({ actualType: describeType(letNameValue), actualValue: letNameValue });
  }
  const letBindingName = letNameValue.name;

  let letParams = [];
  let letBodyLambda;
  if (letArgCount === 3) {
    const letParamsValue = await letLambdas[1](state.pipeValue);
    if (!isVec(letParamsValue)) {
      throw new LetParamsNotVecOfKeywords({ index: -1, actualType: describeType(letParamsValue), actualValue: letParamsValue });
    }
    for (let pi = 0; pi < letParamsValue.length; pi++) {
      if (!isKeyword(letParamsValue[pi])) {
        throw new LetParamsNotVecOfKeywords({ index: pi, actualType: describeType(letParamsValue[pi]), actualValue: letParamsValue[pi] });
      }
    }
    letParams = letParamsValue.map(kw => kw.name);
    letBodyLambda = letLambdas[2];
  } else {
    letBodyLambda = letLambdas[1];
  }

  const letBodyAst = letBodyLambda.astNode;

  if (!classifyEffect(letBindingName) && letBodyAst) {
    const effectOffender = findFirstEffectfulIdentifier(letBodyAst);
    if (effectOffender !== null) {
      throw new EffectLaunderingAtLetParse({
        letName: letBindingName,
        effectfulName: effectOffender,
        location: letBodyAst.location
      });
    }
  }

  const letEnvRef = { env: null };
  const letConduit = makeConduit(letBodyAst, {
    name: letBindingName,
    params: letParams,
    envRef: letEnvRef,
    docs: letLambdas.docs,
    location: letBodyAst.location
  });
  const letNextEnv = envSet(state.env, letBindingName, letConduit);
  letEnvRef.env = letNextEnv;
  return makeState(state.pipeValue, letNextEnv);
}, [2, 3]);

// as(:name) — snapshot the current pipeValue under a keyword name.
export const asOperand = stateOp('as', 2, async (state, asLambdas) => {
  const asNameValue = await asLambdas[0](state.pipeValue);
  if (!isKeyword(asNameValue)) {
    throw new AsNameNotKeyword({ actualType: describeType(asNameValue), actualValue: asNameValue });
  }
  const asBindingName = asNameValue.name;
  const asSnapshot = makeSnapshot(state.pipeValue, {
    name: asBindingName,
    docs: asLambdas.docs,
    location: asLambdas.location
  });
  const asNextEnv = envSet(state.env, asBindingName, asSnapshot);
  return makeState(state.pipeValue, asNextEnv);
});

// ── parse / eval — the code-as-data ring closer ─────────────
//
// parse(source-string) → AST-Map      (the `read` primitive)
// eval(ast-map)        → pipeValue    (the `eval` primitive)
//
// Together they close the loop that motivated the whole Variant-B
// refactor: "qlang code" | parse | eval lifts a source string into
// an AST-Map (via walk.mjs::astNodeToMap) and then re-enters the
// evaluator against the current state (via walk.mjs::qlangMapToAst
// + evalAst). Structured trail entries, programmatic conduit body
// inspection, and hand-rolled AST construction all become user-
// level qlang operations from this point on.

const ParseSubjectNotString = declareSubjectError(
  'ParseSubjectNotString', 'parse', 'string');

const EvalSubjectNotMap = declareSubjectError(
  'EvalSubjectNotMap', 'eval', 'AST Map');

// parse — reads a source string into the Variant-B AST-Map form.
// Malformed sources surface on the fail-track: the underlying
// peggy ParseError is caught and converted to a qlang error value
// via errorFromParse, which stamps :kind :parse-error and the
// peggy source location onto the descriptor. The converted error
// becomes the new pipeValue directly — no throw into evalNode,
// because evalNode's fallback conversion treats ParseError as a
// foreign error (kind :foreign-error) which loses the parse-
// specific discriminator a user-facing operand should preserve.
export const parseOperand = stateOp('parse', 1, async (state, _parseLambdas) => {
  const parseSrc = state.pipeValue;
  if (typeof parseSrc !== 'string') {
    throw new ParseSubjectNotString(describeType(parseSrc), parseSrc);
  }
  try {
    const parsedAst = parseSource(parseSrc, { uri: 'parse-operand' });
    return withPipeValue(state, astNodeToMap(parsedAst));
  } catch (parseErr) {
    return withPipeValue(state, errorFromParse(parseErr));
  }
});

// eval — takes an AST-Map (produced by parse or hand-constructed
// via astNodeToMap-style data assembly) and runs it against the
// current state. The current pipeValue becomes the initial
// pipeValue of the inner evaluation, and env is threaded in
// unchanged — writes that the inner code does through let / as
// land in state.env exactly as if the code had been inlined at
// the call site. The result is whatever pipeValue the inner code
// produces; env changes from inner let / as / use calls propagate
// out, matching the semantics of a bare paren-group application.
export const evalOperand = stateOp('eval', 1, async (state, _evalLambdas) => {
  const evalAstMap = state.pipeValue;
  if (!isQMap(evalAstMap)) {
    throw new EvalSubjectNotMap(describeType(evalAstMap), evalAstMap);
  }
  const reconstructedAst = qlangMapToAst(evalAstMap);
  return await evalAst(reconstructedAst, state);
});

// ── Variant-B primitive registry bindings ─────────────────────
// Bind each reflective operand impl into PRIMITIVE_REGISTRY under
// its :qlang/prim/ namespaced key at module-load time. Note that
// `letOperand` / `asOperand` / `parseOperand` / `evalOperand` are
// the JS-level identifiers for the qlang operands `let` / `as` /
// `parse` / `eval` (those names are JS reserved / common enough
// that the JS-side identifier disambiguates); the registry keys
// use the qlang names.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/env'),         env);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/use'),         use);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/reify'),       reify);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/runExamples'), runExamples);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/manifest'),    manifest);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/let'),         letOperand);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/as'),          asOperand);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/parse'),       parseOperand);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/eval'),        evalOperand);

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

import { stateOp, stateOpVariadic } from './dispatch.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { astNodeToMap, qlangMapToAst, locationToQlangMap } from '../walk.mjs';
import { makeState, withPipeValue, envMerge } from '../state.mjs';
import {
  isQMap, isFunctionValue, isConduit, isSnapshot, isKeyword,
  isVec, isQSet, isNumber, isString, isBoolean, isNull,
  typeKeyword, keyword, makeConduit, makeSnapshot, isErrorValue
} from '../types.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { errorFromParse } from '../error-convert.mjs';
import {
  UnresolvedIdentifierError,
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
  ({ actualType }) => `use(:namespace) requires a keyword, got ${actualType.name}`);
const UseNamespaceNotFound = declareShapeError('UseNamespaceNotFound',
  ({ namespaceName }) => `use: namespace '${namespaceName}' not found in env`);
const UseNamespaceNotMap = declareShapeError('UseNamespaceNotMap',
  ({ namespaceName, actualType }) => `use: namespace '${namespaceName}' is ${actualType.name}, expected Map`);
const UseNamespaceElementNotKeyword = declareShapeError('UseNamespaceElementNotKeyword',
  ({ index, actualType }) => `use: element ${index} of namespace list must be a keyword, got ${actualType.name}`);
const UseNamespaceCollision = declareShapeError('UseNamespaceCollision',
  ({ collidingName, namespaces }) => `use: name '${collidingName}' exported by multiple namespaces: ${namespaces.join(', ')}`);
const UseNameNotExported = declareShapeError('UseNameNotExported',
  ({ namespaceName, exportName }) => `use: '${exportName}' not exported by namespace '${namespaceName}'`);
const ReifyArityOverflow = declareArityError('ReifyArityOverflow',
  ({ actualArity }) => `reify accepts 0 or 1 captured args, got ${actualArity}`);
const ReifyKeyNotKeyword = declareShapeError('ReifyKeyNotKeyword',
  ({ actualType }) => `reify(:name) requires a keyword captured arg, got ${actualType.name}`);

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
      throw new UseSubjectNotMap(state.pipeValue);
    }
    return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
  }

  const useArg = await useLambdas[0](state.pipeValue);

  if (useLambdas.length === 1) {
    // Single arg — dispatch by type
    if (isKeyword(useArg))  return await importSingleNamespace(state, useArg);
    if (isVec(useArg))      return await importOrderedNamespaces(state, useArg);
    if (isQSet(useArg))     return await importUnorderedNamespaces(state, useArg);
    throw new UseNamespaceNotKeyword({ actualType: typeKeyword(useArg), actualValue: useArg });
  }

  // Two args: namespace keyword + selection filter
  if (!isKeyword(useArg)) {
    throw new UseNamespaceNotKeyword({ actualType: typeKeyword(useArg), actualValue: useArg });
  }
  const useSelection = await useLambdas[1](state.pipeValue);
  return await importSelectiveNamespace(state, useArg, useSelection);
}, [0, 2]);

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
  if (outerEnv.has(nsKeyword.name)) {
    const moduleEnv = outerEnv.get(nsKeyword.name);
    if (!isQMap(moduleEnv)) {
      throw new UseNamespaceNotMap({
        namespaceName: nsKeyword.name,
        actualType: typeKeyword(moduleEnv)
      });
    }
    return [moduleEnv, outerEnv];
  }

  // Locator fallback: host-provided lazy module loader.
  const locatorFn = outerEnv.get('qlang/locator');
  if (!locatorFn) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }
  const locatorResult = await locatorFn(nsKeyword.name);
  if (!locatorResult) {
    throw new UseNamespaceNotFound({ namespaceName: nsKeyword.name });
  }

  // Parse and eval the module source. The module is a Map
  // expression (like core.qlang) — its pipeValue IS the exports.
  // Env-delta modules (let declarations) work too: their env delta
  // is picked up below as a fallback when pipeValue is not a Map.
  const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
  const moduleEvalState = makeState(outerEnv, outerEnv);
  const moduleResultState = await evalAst(moduleAst, moduleEvalState);

  // Export surface = env delta (bindings the module added).
  // Modules using | use to install descriptor Maps into env work
  // through this path. Pure Map-expression modules (no | use) must
  // pipe through use to land their entries in env.
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
      const implDescriptor = loadedExports.get(implName);
      const descKind = isQMap(implDescriptor) && implDescriptor.get('qlang/kind');
      if (descKind && descKind.name === 'builtin') {
        implDescriptor.set('qlang/impl', implFn);
      }
    }
  }

  // Install namespace keyword → exports in env for subsequent lookups.
  const envWithNamespace = new Map(outerEnv);
  envWithNamespace.set(nsKeyword.name, loadedExports);
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
      throw new UseNamespaceElementNotKeyword({ index: i, actualType: typeKeyword(ns) });
    }
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(currentEnv, ns);
    currentEnv = envMerge(updatedEnv, moduleEnv);
  }
  return makeState(state.pipeValue, currentEnv);
}

async function importUnorderedNamespaces(state, namespaces) {
  const merged = new Map();
  const origins = new Map();
  let accumulatedEnv = state.env;
  for (const ns of namespaces) {
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(accumulatedEnv, ns);
    accumulatedEnv = updatedEnv;
    for (const [k, v] of moduleEnv) {
      if (merged.has(k)) {
        throw new UseNamespaceCollision({
          collidingName: k,
          namespaces: [origins.get(k), ns.name]
        });
      }
      merged.set(k, v);
      origins.set(k, ns.name);
    }
  }
  return makeState(state.pipeValue, envMerge(accumulatedEnv, merged));
}

async function importSelectiveNamespace(state, nsKeyword, selection) {
  const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state.env, nsKeyword);
  const names = isQSet(selection) ? [...selection] : isVec(selection) ? selection : [selection];
  const filtered = new Map();
  for (const name of names) {
    const nameStr = isKeyword(name) ? name.name : String(name);
    if (!moduleEnv.has(nameStr)) {
      throw new UseNameNotExported({
        namespaceName: nsKeyword.name,
        exportName: nameStr
      });
    }
    filtered.set(nameStr, moduleEnv.get(nameStr));
  }
  return makeState(state.pipeValue, envMerge(updatedEnv, filtered));
}

// ── reify and manifest ─────────────────────────────────────────


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
  return errorValue.descriptor.get('message');
}

function buildBuiltinDescriptor(fn, explicitName) {
  const meta = fn.meta;
  const result = new Map();
  result.set('kind', keyword('builtin'));
  result.set('name', bindingName(explicitName, fn));
  result.set('category', categoryKeyword(meta));
  result.set('subject', meta.subject);
  result.set('modifiers', metaToVec(meta.modifiers));
  result.set('returns', meta.returns);
  result.set('captured', metaToVec(capturedRange(fn)));
  result.set('docs', metaToVec(meta.docs));
  result.set('examples', metaToVec(meta.examples));
  result.set('throws', metaToVec(meta.throws));
  result.set('effectful', fn.effectful);
  return result;
}

// Variant-B descriptor field constants for Map-based reads.

function buildConduitDescriptor(conduit, explicitName) {
  const result = new Map();
  result.set('kind', keyword('conduit'));
  result.set('name', explicitName ?? conduit.get('name'));
  result.set('params', metaToVec(conduit.get('params')));
  result.set('source', conduit.get('qlang/body').text);
  result.set('docs', metaToVec(conduit.get('docs')));
  result.set('effectful', conduit.get('effectful'));
  result.set('location', locationToQlangMap(conduit.get('location')));
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
  const value = snap.get('qlang/value');
  const result = new Map();
  result.set('kind', keyword('snapshot'));
  result.set('name', explicitName);
  result.set('value', value);
  result.set('type', typeKeyword(value));
  result.set('docs', metaToVec(snap.get('docs')));
  result.set('effectful', snap.get('effectful'));
  result.set('location', locationToQlangMap(snap.get('location')));
  return result;
}

function buildValueDescriptor(value, explicitName) {
  const result = new Map();
  result.set('kind', keyword('value'));
  if (explicitName != null) result.set('name', explicitName);
  result.set('value', value);
  result.set('type', typeKeyword(value));
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
  const qlKind = isQMap(value) && value.get('qlang/kind');
  if (qlKind && qlKind.name === 'builtin') {
    const reifyResult = new Map();
    reifyResult.set('kind', keyword('builtin'));
    if (explicitName != null) reifyResult.set('name', explicitName);
    for (const [descKey, descVal] of value) {
      if (descKey === 'qlang/kind' || descKey === 'qlang/impl') continue;
      reifyResult.set(descKey, descVal);
    }
    const implFn = value.get('qlang/impl');
    reifyResult.set('captured', [...implFn.meta.captured]);
    reifyResult.set('effectful', implFn.effectful);
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
      throw new ReifyKeyNotKeyword({ actualType: typeKeyword(reifyKeyValue), actualValue: reifyKeyValue });
    }
    if (!state.env.has(reifyKeyValue.name)) {
      throw new UnresolvedIdentifierError(reifyKeyValue.name);
    }
    const reifyBound = state.env.get(reifyKeyValue.name);
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
  const snippetSrc = isQMap(exampleMap) ? exampleMap.get('snippet') : null;
  const expectedSrc = isQMap(exampleMap) ? exampleMap.get('expected') : null;
  const exampleDoc = isQMap(exampleMap) ? exampleMap.get('doc') : null;

  exampleResult.set('snippet', snippetSrc);
  exampleResult.set('doc', exampleDoc);
  exampleResult.set('expected', expectedSrc);

  if (typeof snippetSrc !== 'string') {
    exampleResult.set('actual', null);
    exampleResult.set('error', 'example :snippet must be a string');
    exampleResult.set('ok', false);
    return exampleResult;
  }

  if (typeof expectedSrc !== 'string') {
    // Demo mode — parse-verify only, no eval.
    try {
      parseSource(snippetSrc);
    } catch (parseVerifyErr) {
      exampleResult.set('actual', null);
      exampleResult.set('error', parseVerifyErr.message);
      exampleResult.set('ok', false);
      return exampleResult;
    }
    exampleResult.set('actual', null);
    exampleResult.set('error', null);
    exampleResult.set('ok', true);
    return exampleResult;
  }

  // Assertion mode — both snippet and expected are eval'd and compared.
  const actualValue = await evalQuery(snippetSrc);
  if (isErrorValue(actualValue)) {
    exampleResult.set('actual', null);
    exampleResult.set('error', errorMessageOf(actualValue));
    exampleResult.set('ok', false);
    return exampleResult;
  }
  exampleResult.set('actual', actualValue);

  const expectedValue = await evalQuery(expectedSrc);
  if (isErrorValue(expectedValue)) {
    exampleResult.set('error', 'expected: ' + errorMessageOf(expectedValue));
    exampleResult.set('ok', false);
    return exampleResult;
  }
  exampleResult.set('error', null);
  exampleResult.set('ok', deepEqual(actualValue, expectedValue));
  return exampleResult;
}

export const runExamples = stateOp('runExamples', 1, async (state, _runExLambdas) => {
  const runExSubject = state.pipeValue;
  if (!isQMap(runExSubject)) {
    throw new RunExamplesSubjectNotDescriptor(runExSubject);
  }
  const runExExamples = runExSubject.get('examples');
  if (!isVec(runExExamples)) {
    const runExKind = runExSubject.get('kind');
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
    if (typeof k === 'string') {
      entries.push({ name: k, key: k, value: v });
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const descriptors = entries.map(e => describeBinding(e.value, e.name));
  return withPipeValue(state, descriptors);
});

// ── let and as — binding operands ─────────────────────────────

const LetNameNotKeyword = declareShapeError('LetNameNotKeyword',
  ({ actualType }) => `let requires a keyword as its first argument (the binding name), got ${actualType.name}`);
const LetParamsNotVecOfKeywords = declareShapeError('LetParamsNotVecOfKeywords',
  ({ index, actualType }) => `let parameter list must be a Vec of keywords; element ${index} is ${actualType.name}`);
const LetBodyMissing = declareArityError('LetBodyMissing',
  ({ actualCount }) => `let requires 2 arguments (name, body) or 3 arguments (name, params, body), got ${actualCount}`);
const AsNameNotKeyword = declareShapeError('AsNameNotKeyword',
  ({ actualType }) => `as requires a keyword argument (the binding name), got ${actualType.name}`);

import { envSet } from '../state.mjs';

export const letOperand = stateOpVariadic('let', 16, async (state, letLambdas) => {
  const letArgCount = letLambdas.length;
  if (letArgCount < 2 || letArgCount > 3) {
    throw new LetBodyMissing({ actualCount: letArgCount });
  }

  const letNameValue = await letLambdas[0](state.pipeValue);
  if (!isKeyword(letNameValue)) {
    throw new LetNameNotKeyword({ actualType: typeKeyword(letNameValue), actualValue: letNameValue });
  }
  const letBindingName = letNameValue.name;

  let letParams = [];
  let letBodyLambda;
  if (letArgCount === 3) {
    const letParamsValue = await letLambdas[1](state.pipeValue);
    if (!isVec(letParamsValue)) {
      throw new LetParamsNotVecOfKeywords({ index: -1, actualType: typeKeyword(letParamsValue), actualValue: letParamsValue });
    }
    for (let pi = 0; pi < letParamsValue.length; pi++) {
      if (!isKeyword(letParamsValue[pi])) {
        throw new LetParamsNotVecOfKeywords({ index: pi, actualType: typeKeyword(letParamsValue[pi]), actualValue: letParamsValue[pi] });
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
    throw new AsNameNotKeyword({ actualType: typeKeyword(asNameValue), actualValue: asNameValue });
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
  'ParseSubjectNotString', 'parse', 'String');

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
    throw new ParseSubjectNotString(parseSrc);
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
    throw new EvalSubjectNotMap(evalAstMap);
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
PRIMITIVE_REGISTRY.bind('qlang/prim/env',         env);
PRIMITIVE_REGISTRY.bind('qlang/prim/use',         use);
PRIMITIVE_REGISTRY.bind('qlang/prim/reify',       reify);
PRIMITIVE_REGISTRY.bind('qlang/prim/runExamples', runExamples);
PRIMITIVE_REGISTRY.bind('qlang/prim/manifest',    manifest);
PRIMITIVE_REGISTRY.bind('qlang/prim/let',         letOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/as',          asOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/parse',       parseOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/eval',        evalOperand);

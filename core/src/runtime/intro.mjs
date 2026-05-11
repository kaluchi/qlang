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
  isVec, isQSet, isQuote,
  typeKeyword, keyword, makeConduit, makeSnapshot, makeQuote, makeDoc, isErrorValue
} from '../types.mjs';
import {
  declareSubjectError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { errorFromParse } from '../error-convert.mjs';
import {
  UnresolvedIdentifierError,
  EffectLaunderingAtDefParse
} from '../errors.mjs';
import { findFirstEffectfulIdentifier } from '../effect-check.mjs';
import { classifyEffect } from '../effect.mjs';
// Live ESM binding into eval.mjs — runtime/index.mjs → intro.mjs →
// eval.mjs → runtime/index.mjs forms a cycle; we never touch
// evalQuery at module-init time, only from inside the runExamples
// closure which is called long after every module has finished
// loading, so the binding resolves correctly.
import { evalQuery, evalAst } from '../eval.mjs';
import { parse as parseSource } from '../parse.mjs';
import { findDefStepAcrossModules } from './axis.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

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
    // Zero captured args: merge pipeValue Map into env
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
  // Stamp the loaded module's source as a Quote-value under the
  // canonical `qlang/ast/<ns>` env key — same surface the core
  // module gets in langRuntime, so axis-operands walk every
  // loaded namespace through one mechanism.
  envWithNamespace.set('qlang/ast/' + nsKeyword.name, makeQuote(locatorResult.source, moduleAst));
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
  result.set('source', conduit.get('qlang/source'));
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

const RunExamplesSubjectShapeError = declareShapeError('RunExamplesSubjectShapeError',
  ({ actualType }) => `runExamples requires a Keyword (binding name) or a descriptor Map carrying a :name string, got ${actualType.name}`);

// runQuoteEntry(quote) → result Map
//
// Each Quote segment in a binding's doc is an executable test case.
// Eval the Quote's source in an isolated env; truthy success → ok,
// error or falsy (false / null) → fail. Result Map shape:
//   {:snippet <Quote> :actual <value> :ok <bool> :error <string|null>}
async function runQuoteEntry(quote) {
  const result = new Map();
  result.set('snippet', quote);
  const actualValue = await evalQuery(quote.source);
  if (isErrorValue(actualValue)) {
    result.set('actual', null);
    result.set('error', errorMessageOf(actualValue));
    result.set('ok', false);
    return result;
  }
  result.set('actual', actualValue);
  result.set('error', null);
  result.set('ok', actualValue !== false && actualValue !== null);
  return result;
}

async function collectQuotesForBinding(env, bindingName) {
  const step = findDefStepAcrossModules(env, bindingName);
  // Bindings without a source-located def-step (the bootstrap def
  // descriptor itself, host-installed bindings via session.bind)
  // simply have no examples to run. runExamples returns an empty
  // Vec — the catalog walk in manifest-self-test treats them as
  // zero-contribution rather than a failure.
  if (step === null) return [];
  const docStrings = step.docs ?? [];
  const collected = [];
  for (const docStr of docStrings) {
    const segments = await parseDocSegments(docStr, env);
    for (const seg of segments) {
      if (isQuote(seg)) collected.push(seg);
    }
  }
  return collected;
}

export const runExamples = stateOp('runExamples', 1, async (state, _runExLambdas) => {
  const subject = state.pipeValue;
  let bindingName;
  if (isKeyword(subject)) {
    bindingName = subject.name;
  } else if (isQMap(subject) && typeof subject.get('name') === 'string') {
    bindingName = subject.get('name');
  } else {
    throw new RunExamplesSubjectShapeError({ actualType: typeKeyword(subject), actualValue: subject });
  }
  const quotes = await collectQuotesForBinding(state.env, bindingName);
  const results = await Promise.all(quotes.map(runQuoteEntry));
  return withPipeValue(state, results);
});

// manifest — Vec of descriptors, one per value-namespace binding
// in env, sorted by name. Reserved namespaces filtered:
//   `qlang/ast/<uri>` — module Quote storage for axis-operand traversal
//   `::<tag>`         — type-namespace bindings (type definitions)
// Both are runtime housekeeping or live in a parallel namespace,
// not the value-level operand catalog manifest is documenting.
export const manifest = stateOp('manifest', 1, (state, _lambdas) => {
  const entries = [];
  for (const [k, v] of state.env) {
    if (k.startsWith('qlang/ast/')) continue;
    if (k.startsWith('::')) continue;
    entries.push({ name: k, key: k, value: v });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const descriptors = entries.map(e => describeBinding(e.value, e.name));
  return withPipeValue(state, descriptors);
});

// ── let and as — binding operands ─────────────────────────────

const AsNameNotKeyword = declareShapeError('AsNameNotKeyword',
  ({ actualType }) => `as requires a keyword argument (the binding name), got ${actualType.name}`);

import { envSet } from '../state.mjs';

const DefNameNotKeyword = declareShapeError('DefNameNotKeyword',
  ({ actualType }) => `def requires a keyword as its first argument (the binding name), got ${actualType.name}`);
const DefParamsNotVecOfKeywords = declareShapeError('DefParamsNotVecOfKeywords',
  ({ index, actualType }) => `def parameter list must be a Vec of keywords; element ${index} is ${actualType.name}`);
const DefArityInvalid = declareArityError('DefArityInvalid',
  ({ actualCount }) => `def requires 1 (name with attached doc), 2 (name, body), or 3 (name, params, body) arguments, got ${actualCount}`);
const DefMissingDocOrBody = declareShapeError('DefMissingDocOrBody',
  ({ bindingName }) => `def(:${bindingName}) — 1-arg form requires an attached doc-prefix; without it neither a value nor a documentation source is available`);

// Pure-literal AST detection: a body whose evaluation is independent
// of pipeValue, env, and any side-effect operand. Pure bodies eval at
// def-time and bind as a snapshot of the resulting value; impure
// bodies bind as a conduit whose AST is invoked lazily per-lookup.
function isPureLiteralAst(node) {
  switch (node.type) {
    case 'NumberLit':
    case 'StringLit':
    case 'BooleanLit':
    case 'NullLit':
    case 'Keyword':
    case 'QuoteLit':
    case 'DocLit':
    case 'BareTypeKeyword':
      return true;
    case 'VecLit':
    case 'JsonArrayLit':
    case 'SetLit':
      return node.elements.every(isPureLiteralAst);
    case 'MapLit':
    case 'JsonObjectLit':
    case 'ErrorLit':
      return node.entries.every(e => isPureLiteralAst(e.value));
    case 'TaggedLit':
      return isPureLiteralAst(node.payload);
    default:
      return false;
  }
}

function checkEffectLaundering(bindingName, bodyAst) {
  if (classifyEffect(bindingName) || !bodyAst) return;
  const offender = findFirstEffectfulIdentifier(bodyAst);
  if (offender !== null) {
    throw new EffectLaunderingAtDefParse({
      defName: bindingName,
      effectfulName: offender,
      location: bodyAst.location
    });
  }
}

// def(:name) / def(:name, body) / def(:name, [:params], body)
//
// Pipeline-transparent declarative binding — pipeValue passes through
// unchanged so def-steps chain naturally on the success-track. Three
// arity-driven forms:
//
//   1-arg `def(:name)` — attached doc-prefix is materialized as a
//     Doc-value and bound under :name. Without an attached doc the
//     call has nothing to bind and raises DefMissingDocOrBody.
//
//   2-arg `def(:name, body)` — purity-analysis on the body AST: a
//     pure literal (NumberLit / StringLit / Keyword / VecLit /
//     MapLit / ... recursively) evaluates at def-time and binds as a
//     snapshot of the value; an impure body (containing OperandCall,
//     Projection, ParenGroup, Pipeline) binds as a zero-param conduit
//     invoked lazily per-lookup.
//
//   3-arg `def(:name, [:p ...], body)` — parametric conduit; always
//     deferred regardless of body shape.
//
// Effect-laundering safety net mirrors the let-time AST scan: a
// non-`@`-prefixed binding name with an effectful body raises
// EffectLaunderingAtDefParse.
export const defOperand = stateOpVariadic('def', 16, async (state, defLambdas) => {
  const argCount = defLambdas.length;
  if (argCount < 1 || argCount > 3) {
    throw new DefArityInvalid({ actualCount: argCount });
  }

  // The name argument may be either a Keyword (`def(:foo, ...)` —
  // value-namespace binding) or a BareTypeKeyword AST node
  // (`def(::foo, ...)` — type-namespace binding stored in env under
  // the `::`-prefixed key). The grammar disambiguates them; we
  // route by inspecting the captured-arg AST shape before
  // evaluating it.
  const nameAst = defLambdas[0].astNode;
  let bindingName;
  if (nameAst && nameAst.type === 'BareTypeKeyword') {
    bindingName = '::' + nameAst.tag;
  } else {
    const nameValue = await defLambdas[0](state.pipeValue);
    if (!isKeyword(nameValue)) {
      throw new DefNameNotKeyword({ actualType: typeKeyword(nameValue), actualValue: nameValue });
    }
    bindingName = nameValue.name;
  }
  const attachedDocs = defLambdas.docs;

  if (argCount === 1) {
    if (!attachedDocs || attachedDocs.length === 0) {
      throw new DefMissingDocOrBody({ bindingName });
    }
    const docValue = makeDoc(attachedDocs.join('\n'));
    const docSnapshot = makeSnapshot(docValue, {
      name: bindingName,
      docs: attachedDocs,
      location: defLambdas.location
    });
    return makeState(state.pipeValue, envSet(state.env, bindingName, docSnapshot));
  }

  if (argCount === 3) {
    const paramsValue = await defLambdas[1](state.pipeValue);
    if (!isVec(paramsValue)) {
      throw new DefParamsNotVecOfKeywords({ index: -1, actualType: typeKeyword(paramsValue), actualValue: paramsValue });
    }
    for (let pi = 0; pi < paramsValue.length; pi++) {
      if (!isKeyword(paramsValue[pi])) {
        throw new DefParamsNotVecOfKeywords({ index: pi, actualType: typeKeyword(paramsValue[pi]), actualValue: paramsValue[pi] });
      }
    }
    const params = paramsValue.map(kw => kw.name);
    const bodyAst = defLambdas[2].astNode;
    checkEffectLaundering(bindingName, bodyAst);
    const envRef = { env: null };
    const conduit = makeConduit(bodyAst, {
      name: bindingName,
      params,
      envRef,
      docs: attachedDocs,
      location: bodyAst.location
    });
    const nextEnv = envSet(state.env, bindingName, conduit);
    envRef.env = nextEnv;
    return makeState(state.pipeValue, nextEnv);
  }

  // 2-arg form: purity-analysis routes between snapshot and conduit.
  const bodyLambda = defLambdas[1];
  const bodyAst = bodyLambda.astNode;
  checkEffectLaundering(bindingName, bodyAst);

  if (isPureLiteralAst(bodyAst)) {
    const evaluatedValue = await bodyLambda(state.pipeValue);
    const snapshot = makeSnapshot(evaluatedValue, {
      name: bindingName,
      docs: attachedDocs,
      location: bodyAst.location
    });
    return makeState(state.pipeValue, envSet(state.env, bindingName, snapshot));
  }

  const envRef = { env: null };
  const conduit = makeConduit(bodyAst, {
    name: bindingName,
    params: [],
    envRef,
    docs: attachedDocs,
    location: bodyAst.location
  });
  const nextEnv = envSet(state.env, bindingName, conduit);
  envRef.env = nextEnv;
  return makeState(state.pipeValue, nextEnv);
}, [1, 3]);

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

const ParseSubjectNotStringOrQuote = declareSubjectError(
  'ParseSubjectNotStringOrQuote', 'parse', 'String or Quote');

const EvalSubjectNotMapOrQuote = declareSubjectError(
  'EvalSubjectNotMapOrQuote', 'eval', 'AST Map or Quote');

// parse — reads a source string into the Variant-B AST-Map form.
// A Quote-value is accepted too: it is "code in string form", so
// `\`5 | mul(2)\` | parse` is the same as `"5 | mul(2)" | parse`
// minus the escape boilerplate. Malformed sources surface on the
// fail-track: the peggy ParseError is caught and converted to a
// qlang error value via errorFromParse, which stamps :kind
// :parse-error and the peggy source location onto the descriptor.
// The converted error becomes the new pipeValue directly — no
// throw into evalNode, because evalNode's fallback conversion
// treats ParseError as a foreign error (kind :foreign-error) which
// loses the parse-specific discriminator a user-facing operand
// should preserve.
export const parseOperand = stateOp('parse', 1, async (state, _parseLambdas) => {
  const parseSrc = state.pipeValue;
  let sourceText;
  if (typeof parseSrc === 'string') sourceText = parseSrc;
  else if (isQuote(parseSrc))       sourceText = parseSrc.source;
  else throw new ParseSubjectNotStringOrQuote(parseSrc);
  try {
    const parsedAst = parseSource(sourceText, { uri: 'parse-operand' });
    return withPipeValue(state, astNodeToMap(parsedAst));
  } catch (parseErr) {
    return withPipeValue(state, errorFromParse(parseErr));
  }
});

// eval — runs an AST against the current state. Subject is either
// an AST-Map (the `parse` output, or a hand-constructed Map via
// astNodeToMap-style data assembly) or a Quote (raw qlang source
// in string form — parsed on the fly). The current pipeValue
// becomes the initial pipeValue of the inner evaluation, and env
// is threaded in unchanged: writes the inner code does through let /
// as land in state.env exactly as if the code had been inlined at
// the call site. The result is whatever pipeValue the inner code
// produces; env changes from inner def / as / use calls propagate
// out, matching the semantics of a bare paren-group application.
export const evalOperand = stateOp('eval', 1, async (state, _evalLambdas) => {
  const evalSubject = state.pipeValue;
  let reconstructedAst;
  if (isQMap(evalSubject)) {
    reconstructedAst = qlangMapToAst(evalSubject);
  } else if (isQuote(evalSubject)) {
    reconstructedAst = evalSubject.ast ?? parseSource(evalSubject.source, { uri: 'eval-operand' });
  } else {
    throw new EvalSubjectNotMapOrQuote(evalSubject);
  }
  return await evalAst(reconstructedAst, state);
});

// ── Variant-B primitive registry bindings ─────────────────────
// Bind each reflective operand impl into PRIMITIVE_REGISTRY under
// its :qlang/prim/ namespaced key at module-load time. Note that
// `defOperand` / `asOperand` / `parseOperand` / `evalOperand` are
// the JS-level identifiers for the qlang operands `def` / `as` /
// `parse` / `eval` (the qlang names are JS reserved / common enough
// that the JS-side identifier disambiguates); the registry keys
// use the qlang names.
PRIMITIVE_REGISTRY.bind('qlang/prim/env',         env);
PRIMITIVE_REGISTRY.bind('qlang/prim/use',         use);
PRIMITIVE_REGISTRY.bind('qlang/prim/reify',       reify);
PRIMITIVE_REGISTRY.bind('qlang/prim/runExamples', runExamples);
PRIMITIVE_REGISTRY.bind('qlang/prim/manifest',    manifest);
PRIMITIVE_REGISTRY.bind('qlang/prim/def',         defOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/as',          asOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/parse',       parseOperand);
PRIMITIVE_REGISTRY.bind('qlang/prim/eval',        evalOperand);

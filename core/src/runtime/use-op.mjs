// `use` operand — merges a Map of bindings into env. Arity-1
// dispatches by captured-arg shape:
//
//   bare `pipeValue | use`            — pipeValue must be a Map.
//                                        Every entry is merged into
//                                        env (incoming wins on
//                                        collisions).
//   `use(:ns)`                        — namespace import. The
//                                        keyword resolves to a
//                                        module Map already in env
//                                        (or loaded on demand
//                                        through the
//                                        `:qlang/locator` host
//                                        callback).
//   `use([:ns1 :ns2 …])`              — ordered namespace import.
//                                        Later namespaces shadow
//                                        earlier on conflict.
//   `use(#{:ns1 :ns2 …})`             — unordered namespace import.
//                                        Collisions raise a
//                                        `UseNamespaceCollisionError`
//                                        so the host disambiguates.
//   `use(:ns, #{:nameA :nameB})`      — selective import. Only the
//                                        named identifiers land in
//                                        env; everything else stays
//                                        out of scope.

import { stateOpVariadic } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { makeState, envMerge } from '../state.mjs';
import { parse as parseSource } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import {
  isQMap, isKeyword, isVec, isQSet, isSnapshot,
  typeKeyword, makeQuote
} from '../types.mjs';
import {
  moduleAstKey, moduleNamespaceKey, RUNTIME_LOCATOR_KEY
} from '../env-keys.mjs';
import { declareSubjectError, declareShapeError } from '../operand-errors.mjs';
import { stampStructuralFacts } from '../descriptor-ops.mjs';

const UseSubjectNotMapError = declareSubjectError('UseSubjectNotMapError', 'use', 'map');
const UseNamespaceNotKeywordError = declareShapeError('UseNamespaceNotKeywordError',
  ({ actualType }) => `use(:namespace) requires a keyword, got ${actualType.name}`);
const UseNamespaceNotFoundError = declareShapeError('UseNamespaceNotFoundError',
  ({ namespaceName }) => `use: namespace '${namespaceName}' not found in env`);
const UseNamespaceNotMapError = declareShapeError('UseNamespaceNotMapError',
  ({ namespaceName, actualType }) => `use: namespace '${namespaceName}' is ${actualType.name}, expected Map`);
const UseNamespaceElementNotKeywordError = declareShapeError('UseNamespaceElementNotKeywordError',
  ({ index, actualType }) => `use: element ${index} of namespace list must be a keyword, got ${actualType.name}`);
const UseNamespaceCollisionError = declareShapeError('UseNamespaceCollisionError',
  ({ collidingName, namespaces }) => `use: name '${collidingName}' exported by multiple namespaces: ${namespaces.join(', ')}`);
const UseNameNotExportedError = declareShapeError('UseNameNotExportedError',
  ({ namespaceName, exportName }) => `use: '${exportName}' not exported by namespace '${namespaceName}'`);

export const use = stateOpVariadic('use', 3, async (state, useLambdas) => {
  if (useLambdas.length === 0) {
    if (!isQMap(state.pipeValue)) {
      throw new UseSubjectNotMapError(state.pipeValue);
    }
    return makeState(state.pipeValue, envMerge(state.env, state.pipeValue));
  }

  const useArg = await useLambdas[0](state.pipeValue);

  if (useLambdas.length === 1) {
    if (isKeyword(useArg))  return await importSingleNamespace(state, useArg);
    if (isVec(useArg))      return await importOrderedNamespaces(state, useArg);
    if (isQSet(useArg))     return await importUnorderedNamespaces(state, useArg);
    throw new UseNamespaceNotKeywordError({ actualType: typeKeyword(useArg), actualValue: useArg });
  }

  if (!isKeyword(useArg)) {
    throw new UseNamespaceNotKeywordError({ actualType: typeKeyword(useArg), actualValue: useArg });
  }
  const useSelection = await useLambdas[1](state.pipeValue);
  return await importSelectiveNamespace(state, useArg, useSelection);
}, [0, 2]);

// resolveNamespaceEnv(outerEnv, nsKeyword) → [moduleEnv, updatedOuterEnv]
//
// Looks up the namespace keyword in env. When absent, falls back
// to the host-provided locator (stored under `:qlang/locator` in
// env by `createSession`). The locator parses and evals the module
// source, patches `:impl` on builtin descriptors with the
// impls from the locator result, and installs the namespace
// keyword in env for subsequent lookups. Returns the resolved
// `moduleEnv` paired with the env that holds the freshly-installed
// namespace binding so the caller threads it forward.
async function resolveNamespaceEnv(outerEnv, nsKeyword) {
  // Two cache keys for namespace lookup. `session.bind(:ns, map)`
  // and `installModules(catalog)` write under the bare keyword name
  // (`<ns>`); the language-level locator caches its own loads under
  // a separate prefix (`qlang/namespace/<ns>`) so `manifest` can
  // skip those entries without filtering user-installed namespaces.
  const bareKey  = nsKeyword.name;
  const cacheKey = moduleNamespaceKey(nsKeyword.name);
  for (const key of [bareKey, cacheKey]) {
    if (!outerEnv.has(key)) continue;
    const moduleEnv = outerEnv.get(key);
    if (!isQMap(moduleEnv)) {
      throw new UseNamespaceNotMapError({
        namespaceName: nsKeyword.name,
        actualType: typeKeyword(moduleEnv)
      });
    }
    return [moduleEnv, outerEnv];
  }

  const locatorFn = outerEnv.get(RUNTIME_LOCATOR_KEY);
  if (!locatorFn) {
    throw new UseNamespaceNotFoundError({ namespaceName: nsKeyword.name });
  }
  const locatorResult = await locatorFn(nsKeyword.name);
  if (!locatorResult) {
    throw new UseNamespaceNotFoundError({ namespaceName: nsKeyword.name });
  }

  // Parse and eval the module source. The module is a Map
  // expression (like core.qlang) — its pipeValue IS the exports.
  // Env-delta modules (BindStep declarations) work too: their env
  // delta is picked up below as a fallback when pipeValue is not a
  // Map.
  const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
  const moduleEvalState = makeState(outerEnv, outerEnv);
  const moduleResultState = await evalAst(moduleAst, moduleEvalState);

  // Export surface = env delta. A module exports any binding it
  // ADDED (key absent from outerEnv) or MODIFIED (key present but
  // pointing to a different value — the module's BindStep replaced
  // the entry, producing a fresh Map instance). Identity-compare
  // on the value separates inherited-unchanged from override.
  // Modules using `| use` to install descriptor Maps into env work
  // through this path. Pure Map-expression modules (no `| use`)
  // pipe through `use` to land their entries in env.
  const loadedExports = new Map();
  for (const [exportKey, exportVal] of moduleResultState.env) {
    if (!outerEnv.has(exportKey) || outerEnv.get(exportKey) !== exportVal) {
      loadedExports.set(exportKey, exportVal);
    }
  }

  // Unwrap snapshot-wrapped `::builtin` descriptors before
  // stamping. `evalBindStep` routes a pure-literal body (every
  // `::builtin{…}` TaggedLit qualifies) through `makeSnapshot`,
  // so a freshly-evaluated catalog lands the descriptor under a
  // Snapshot wrapper. `langRuntime`'s own bootstrap unwraps the
  // same shape (see `runtime/index.mjs`); locator-loaded
  // namespaces need the same unwrap pass before
  // `stampStructuralFacts` mutates the descriptor — otherwise
  // the stamping would mint `:impl` / `:captured` /
  // `:effectful` on the Snapshot wrapper, leaving the inner
  // builtin Map untouched and downstream dispatch reaching for
  // an undefined `fn.arity`.
  for (const [exportKey, exportVal] of loadedExports) {
    if (!isSnapshot(exportVal)) continue;
    const payload = exportVal.get('payload');
    if (!isQMap(payload)) continue;
    const payloadKind = payload.get('kind');
    if (payloadKind && payloadKind.name === 'builtin') {
      loadedExports.set(exportKey, payload);
    }
  }

  // Stamp the resolved JS function value onto each freshly-built
  // builtin descriptor through the shared `stampStructuralFacts`
  // mint-site — same surface `runtime/index.mjs::buildLangRuntime`
  // uses for the core catalog. Locator-loaded descriptors land in
  // env carrying a resolved JS function value on `:impl` plus the
  // structural-from-impl backfill (`:captured` / `:effectful` /
  // empty-fallback `:modifiers` / `:throws`) so `spec` axis and
  // `manifest` enumeration read them off the env entry uniformly.
  if (locatorResult.impls) {
    for (const [implName, implFn] of Object.entries(locatorResult.impls)) {
      const implDescriptor = loadedExports.get(implName);
      const descKind = isQMap(implDescriptor) && implDescriptor.get('kind');
      if (descKind && descKind.name === 'builtin') {
        stampStructuralFacts(implDescriptor, implFn);
      }
    }
  }

  const envWithNamespace = new Map(outerEnv);
  envWithNamespace.set(cacheKey, loadedExports);
  // Stamp the loaded module's source as a Quote-value under the
  // canonical `qlang/ast/<ns>` env key — same surface the core
  // module gets in langRuntime, so axis-operands walk every
  // loaded namespace through one mechanism.
  envWithNamespace.set(moduleAstKey(nsKeyword.name), makeQuote(locatorResult.source, moduleAst));
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
      throw new UseNamespaceElementNotKeywordError({ index: i, actualType: typeKeyword(ns) });
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
        throw new UseNamespaceCollisionError({
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
      throw new UseNameNotExportedError({
        namespaceName: nsKeyword.name,
        exportName: nameStr
      });
    }
    filtered.set(nameStr, moduleEnv.get(nameStr));
  }
  return makeState(state.pipeValue, envMerge(updatedEnv, filtered));
}

bindPrim('use', use);

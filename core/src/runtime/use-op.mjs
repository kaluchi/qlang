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
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { makeState, envMerge } from '../state.mjs';
import { parse as parseSource } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import {
  isQMap, isKeyword, isVec, isQSet,
  typeKeyword, makeQuote, moduleAstKey
} from '../types.mjs';
import { declareSubjectError, declareShapeError } from '../operand-errors.mjs';

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
// source, patches `:qlang/impl` on builtin descriptors with the
// impls from the locator result, and installs the namespace
// keyword in env for subsequent lookups. Returns the resolved
// `moduleEnv` paired with the env that holds the freshly-installed
// namespace binding so the caller threads it forward.
async function resolveNamespaceEnv(outerEnv, nsKeyword) {
  if (outerEnv.has(nsKeyword.name)) {
    const moduleEnv = outerEnv.get(nsKeyword.name);
    if (!isQMap(moduleEnv)) {
      throw new UseNamespaceNotMapError({
        namespaceName: nsKeyword.name,
        actualType: typeKeyword(moduleEnv)
      });
    }
    return [moduleEnv, outerEnv];
  }

  const locatorFn = outerEnv.get('qlang/locator');
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

  // Export surface = env delta (bindings the module added).
  // Modules using `| use` to install descriptor Maps into env work
  // through this path. Pure Map-expression modules (no `| use`)
  // pipe through `use` to land their entries in env.
  const loadedExports = new Map();
  for (const [exportKey, exportVal] of moduleResultState.env) {
    if (!outerEnv.has(exportKey)) {
      loadedExports.set(exportKey, exportVal);
    }
  }

  // Stamp the resolved JS function value onto each freshly-built
  // builtin descriptor before sealing the export Map. The
  // descriptor is still the loader's mutable build buffer at this
  // point — it becomes immutable once it lands in
  // `envWithNamespace` below — so the `.set` is a single
  // mint-site write under the same factory ceremony as
  // `makeConduit` / `makeSnapshot`.
  if (locatorResult.impls) {
    for (const [implName, implFn] of Object.entries(locatorResult.impls)) {
      const implDescriptor = loadedExports.get(implName);
      const descKind = isQMap(implDescriptor) && implDescriptor.get('qlang/kind');
      if (descKind && descKind.name === 'builtin') {
        implDescriptor.set('qlang/impl', implFn);
      }
    }
  }

  const envWithNamespace = new Map(outerEnv);
  envWithNamespace.set(nsKeyword.name, loadedExports);
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

PRIMITIVE_REGISTRY.bind('qlang/prim/use', use);

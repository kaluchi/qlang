// `use` operand — merges a Map of bindings into env. Arity-1
// dispatches by captured-arg shape:
//
//   bare `pipeValue | use`            — pipeValue must be a Map.
//                                        Every entry is merged into
//                                        env (incoming wins on
//                                        collisions).
//   `use :ns`                        — namespace import. The
//                                        keyword resolves to a
//                                        module Map already in env
//                                        (or loaded on demand
//                                        through the
//                                        `:qlang/locator` host
//                                        callback).
//   `use [:ns1 :ns2 …]`               — Vec-form namespace import.
//                                        Later namespaces shadow
//                                        earlier on conflict.
//   `use #[:ns1 :ns2 …]`              — Set-form namespace import.
//                                        Collisions raise a
//                                        `UseNamespaceCollisionError`
//                                        so the host disambiguates.
//   `use :ns #[:nameA :nameB]`      — selective import. Only the
//                                        named identifiers land in
//                                        env; everything else stays
//                                        out of scope.

import { stateOpVariadic } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withEnv, nestState, envMerge } from '../state.mjs';
import { parse as parseSource } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import {
  isQMap, isKeyword, isVec, isQSet, isBinding, isVerb, keyword, makeBinding, bindingValueOf, resideVerbOn,
  attachHostImpl, typeKeyword, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { canonicalTagName, moduleNamespaceKey, tagBindingKey, RUNTIME_LOCATOR_KEY } from '../env-keys.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { declareShapeError } from '../errors.mjs';
import { stampThrowSiteSpec } from '../descriptor-ops.mjs';

const UseSubjectNotMapError = declareSubjectError('UseSubjectNotMapError', 'use', 'map');
const UseNamespaceNotKeywordError = declareShapeError('UseNamespaceNotKeywordError',
  ({ actualType }) => `use(:namespace) requires a keyword, got ${actualType.name}`,
  { operand: 'use', expectedType: 'keyword' }
);
const UseNamespaceNotFoundError = declareShapeError('UseNamespaceNotFoundError',
  ({ namespaceName }) => `use: namespace '${namespaceName}' not found in env`,
  { operand: 'use' }
);
const UseNamespaceElementNotKeywordError = declareShapeError('UseNamespaceElementNotKeywordError',
  ({ index, actualType }) => `use: element ${index} of namespace list must be a keyword, got ${actualType.name}`,
  { operand: 'use', expectedType: 'keyword' }
);
const UseNamespaceCollisionError = declareShapeError('UseNamespaceCollisionError',
  ({ collidingName, namespaces }) => `use: name '${collidingName}' exported by multiple namespaces: ${namespaces.join(', ')}`,
  { operand: 'use' }
);
const UseImplNamesNoVerbError = declareShapeError('UseImplNamesNoVerbError',
  ({ namespaceName, implName }) => `use: namespace '${namespaceName}' hands an implementation for '${implName}', which its source declares as no verb`,
  { operand: 'use' }
);
const UseNameNotExportedError = declareShapeError('UseNameNotExportedError',
  ({ namespaceName, exportName }) => `use: '${exportName}' not exported by namespace '${namespaceName}'`,
  { operand: 'use' }
);

// A namespace a host bound under a bare name: the record of a
// header-less Map that no step declared [D63].
function isHostNamespace(record) {
  if (!isBinding(record) || record.get('source') !== null) return false;
  const value = record.get('value');
  return isQMap(value) && value[TAG_HEADER_SYMBOL] === undefined;
}

// The bindings a Map of entries brings into a scope [D63]: a record as
// the binding it is, and any other value as a binding without a doc.
function bindingsOf(entries) {
  const bindings = new Map();
  for (const [name, value] of entries) {
    bindings.set(name, isBinding(value) ? value : makeBinding({ name: keyword(name), value }));
  }
  return bindings;
}

export const use = stateOpVariadic('use', async (state, useLambdas) => {
  if (useLambdas.length === 0) {
    if (!isQMap(state.pipeValue)) {
      throw new UseSubjectNotMapError(state.pipeValue);
    }
    return withEnv(state, envMerge(state.env, bindingsOf(state.pipeValue)));
  }

  const useArg = await useLambdas[0](state.pipeValue);

  if (useLambdas.length === 1) {
    if (isKeyword(useArg))  return await importSingleNamespace(state, useArg);
    if (isQSet(useArg))     return await importCollisionStrictNamespaces(state, useArg);
    if (isVec(useArg))      return await importOrderedNamespaces(state, useArg);
    throw new UseNamespaceNotKeywordError({ actualType: typeKeyword(useArg), actualValue: useArg });
  }

  if (!isKeyword(useArg)) {
    throw new UseNamespaceNotKeywordError({ actualType: typeKeyword(useArg), actualValue: useArg });
  }
  const useSelection = await useLambdas[1](state.pipeValue);
  return await importSelectiveNamespace(state, useArg, useSelection);
}, [0, 2]);

// resolveNamespaceEnv(callerState, outerEnv, nsKeyword) → [moduleEnv, updatedOuterEnv]
//
// Looks up the namespace keyword in env. When absent, falls back
// to the host-provided locator (stored under `:qlang/locator` in
// env by `createSession`). The locator parses and evals the module
// source one frame below `callerState` — a module that `use`s itself
// descends a frame per load until the depth budget lifts
// `EvaluationDepthExceededError` — patches `:impl` on builtin
// descriptors with the impls from the locator result, and installs
// the namespace keyword in env for subsequent lookups. Returns the
// resolved `moduleEnv`, a Map of the records the module exports,
// paired with the env that holds the freshly-installed namespace
// binding so the caller threads it forward; `outerEnv` is that
// evolving env, which walks ahead of `callerState.env` across a
// multi-namespace import.
async function resolveNamespaceEnv(callerState, outerEnv, nsKeyword) {
  // Two lookup keys for a namespace. A host `session.bind(:ns, map)`
  // lands under the bare keyword name (`<ns>`); the language-level
  // locator and `installModules(catalog)` both write under the
  // namespace cache key (`qlang/namespace/<ns>`), which `manifest`
  // filters out of its enumeration and which never collides with an
  // operand name on the identifier-lookup plane.
  const cacheKey = moduleNamespaceKey(nsKeyword.name);
  if (outerEnv.has(cacheKey)) return [outerEnv.get(cacheKey), outerEnv];

  // A host-installed namespace is a header-less Map bound under the
  // bare name with no declaration behind it, its entries brought in as
  // bindings. Every other binding there — one a step declared, `:cfg
  // /` among them, an operand descriptor (`use :count`), a verb
  // (`use :double`), a scalar or function a host bound — sits on the
  // identifier plane, so the probe walks past it to the locator:
  // merging a tagged Map would spill its `:impl` slot into env as a
  // binding.
  const hostRecord = outerEnv.get(nsKeyword.name);
  if (isHostNamespace(hostRecord)) return [bindingsOf(hostRecord.get('value')), outerEnv];

  const locatorFn = outerEnv.get(RUNTIME_LOCATOR_KEY);
  if (!locatorFn) {
    throw new UseNamespaceNotFoundError({ namespaceName: nsKeyword.name });
  }
  const locatorResult = await locatorFn(nsKeyword.name);
  if (!locatorResult) {
    throw new UseNamespaceNotFoundError({ namespaceName: nsKeyword.name });
  }

  // Parse and eval the module source. A module exports what its
  // steps write into the environment, the difference taken below;
  // the value its last step answers is left unread.
  const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
  const moduleEvalState = nestState(callerState, outerEnv, outerEnv);
  const moduleResultState = await evalAst(moduleAst, moduleEvalState);

  // Export surface = env delta. A module exports any binding it
  // ADDED (key absent from outerEnv) or MODIFIED (key present but
  // pointing to a different record — the module's BindStep replaced
  // the entry). Identity-compare on the record separates
  // inherited-unchanged from override. Modules using `| use` to
  // install descriptor Maps into env work through this path. Pure
  // Map-expression modules (no `| use`) pipe through `use` to land
  // their entries in env.
  const loadedExports = new Map();
  for (const [exportKey, exportVal] of moduleResultState.env) {
    if (!outerEnv.has(exportKey) || outerEnv.get(exportKey) !== exportVal) {
      loadedExports.set(exportKey, exportVal);
    }
  }

  // A host catalog declares its per-site error tags as prose, the
  // same way the language catalog does; the structural facts come
  // from the factory call in the host's own JS. Stamping here is
  // what `buildLangRuntime` does for the language catalog, at the
  // seam a locator-loaded namespace arrives through.
  for (const [exportKey, exportVal] of loadedExports) {
    stampThrowSiteSpec(bindingValueOf(exportVal), exportKey);
  }

  // A host hands the implementations of the verbs its source declares,
  // each a plain function over the values the verb's head checks, and
  // the loader records each beside its verb [D4], [D80].
  for (const [implName, impl] of Object.entries(locatorResult.impls ?? {})) {
    const declared = bindingValueOf(loadedExports.get(implName));
    if (!isVerb(declared)) throw new UseImplNamesNoVerbError({ namespaceName: nsKeyword.name, implName: keyword(implName) });
    attachHostImpl(declared, impl);
  }

  resideVerbsOnNoun(nsKeyword.name, loadedExports, moduleResultState.env);

  const envWithNamespace = new Map(outerEnv);
  envWithNamespace.set(cacheKey, loadedExports);
  return [loadedExports, envWithNamespace];
}

// A module named by the path of a noun its scope binds is that noun's
// module, and the verbs it declares reside on the noun [D72]; a verb it
// passes on from a module it loaded keeps its own residence.
function resideVerbsOnNoun(moduleName, loadedExports, moduleEnv) {
  const nounName = canonicalTagName(moduleName);
  if (!moduleEnv.has(tagBindingKey(nounName))) return;
  for (const record of loadedExports.values()) {
    const declared = bindingValueOf(record);
    if (isVerb(declared) && record.get('module')?.name === moduleName) resideVerbOn(declared, nounName);
  }
}

async function importSingleNamespace(state, nsKeyword) {
  const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state, state.env, nsKeyword);
  return withEnv(state, envMerge(updatedEnv, moduleEnv));
}

async function importOrderedNamespaces(state, namespaces) {
  let currentEnv = state.env;
  for (let i = 0; i < namespaces.length; i++) {
    const ns = namespaces[i];
    if (!isKeyword(ns)) {
      throw new UseNamespaceElementNotKeywordError({ index: i, actualType: typeKeyword(ns) });
    }
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state, currentEnv, ns);
    currentEnv = envMerge(updatedEnv, moduleEnv);
  }
  return withEnv(state, currentEnv);
}

async function importCollisionStrictNamespaces(state, namespaces) {
  const merged = new Map();
  const origins = new Map();
  let accumulatedEnv = state.env;
  for (const ns of namespaces) {
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state, accumulatedEnv, ns);
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
  return withEnv(state, envMerge(accumulatedEnv, merged));
}

async function importSelectiveNamespace(state, nsKeyword, selection) {
  const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state, state.env, nsKeyword);
  const names = isVec(selection) ? selection : [selection];
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
  return withEnv(state, envMerge(updatedEnv, filtered));
}

bindPrim('use', use);

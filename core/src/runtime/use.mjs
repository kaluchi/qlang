// The loader of the tree of names [D152] and `use`, a verb of any value
// whose primitive writes the scope of its call [D113]; its forms are told
// by its page, `::any/use | doc`.

import { bindScopeWriter } from '../primitives.mjs';
import { nestState, envMerge } from '../state.mjs';
import { parse as parseSource } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import {
  isQMap, isTagKeyword, isVec, isQSet, isNull, isBinding, isKeyword, isVerb, keyword, makeBinding, bindingValueOf,
  resideVerbOn, attachHostImpl, typeKeyword
} from '../types.mjs';
import { canonicalTagName, isRuntimeKey, moduleNamespaceKey, RUNTIME_LOCATOR_KEY } from '../env-keys.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { declareShapeError, recordRefusalAddress, throwSiteSpecOf } from '../errors.mjs';
import { fullPathOf, nodeOf, ROOT_MODULE_PATH } from './nouns.mjs';

const UseSubjectNotMapError = declareSubjectError('UseSubjectNotMapError', 'use', 'map');
const UseNamespaceNotTagError = declareShapeError('UseNamespaceNotTagError',
  ({ actualType }) => `use names a module by its tag, \`use ::lib\`, and got ${actualType.name}`,
  { operand: 'use', expectedType: 'tag' }
);
const UseNamespaceNotFoundError = declareShapeError('UseNamespaceNotFoundError',
  ({ namespaceName }) => `use: no module serves ${namespaceName}`,
  { operand: 'use' }
);
const UseNamespaceElementNotTagError = declareShapeError('UseNamespaceElementNotTagError',
  ({ index, actualType }) => `use: element ${index} of the modules names a module by its tag, got ${actualType.name}`,
  { operand: 'use', expectedType: 'tag' }
);
const UseNamespaceCollisionError = declareShapeError('UseNamespaceCollisionError',
  ({ collidingName, namespaces }) => `use: name '${collidingName}' exported by multiple modules: ${namespaces.join(', ')}`,
  { operand: 'use' }
);
const UseImplNamesNoVerbError = declareShapeError('UseImplNamesNoVerbError',
  ({ namespaceName, implName }) => `use: module '${namespaceName}' hands an implementation for '${implName}', which its source declares as no verb`,
  { operand: 'use' }
);
const UseNameNotExportedError = declareShapeError('UseNameNotExportedError',
  ({ namespaceName, exportName }) => `use: '${exportName}' not exported by module '${namespaceName}'`,
  { operand: 'use' }
);

// The bindings a Map of entries brings into a scope [D63]: a record as
// the binding it is, and any other value as a binding without a doc.
function bindingsOf(entries) {
  const bindings = new Map();
  for (const [name, value] of entries) {
    bindings.set(name, isBinding(value) ? value : makeBinding({ name: keyword(name), value }));
  }
  return bindings;
}

// The keys of the runtime an env carries, which a module's own scope
// starts from: the locator and the modules loaded so far.
function runtimeKeysOf(env) {
  const runtimeEnv = new Map();
  for (const [name, value] of env) if (isRuntimeKey(name)) runtimeEnv.set(name, value);
  return runtimeEnv;
}

// loadModule(callerState, env, path) → [exports, env'] — the bindings the
// module of a path declared and the env that holds its export map from
// then on. A module is read once, through the host's locator, which hands
// its source and the implementations of its verbs, and runs one frame
// below its caller in a scope of its own, where its helpers and what its
// own `use` brought stay [D63]. A verb it declares resides on the noun its
// path addresses [D72], and a refusal it declares takes its address
// [D152]. Null for a path no locator serves.
export async function loadModule(callerState, env, path) {
  const cacheKey = moduleNamespaceKey(path);
  if (env.has(cacheKey)) return [env.get(cacheKey), env];
  const locatorFn = env.get(RUNTIME_LOCATOR_KEY);
  const locatorResult = locatorFn ? await locatorFn(path === ROOT_MODULE_PATH ? 'qlang/core' : path) : null;
  if (!locatorResult) return [null, env];

  const moduleAst = parseSource(locatorResult.source, { uri: path });
  const moduleScope = runtimeKeysOf(env);
  const moduleResultState = await evalAst(moduleAst, nestState(callerState, null, moduleScope));

  const loadedExports = new Map();
  const loadedModules = new Map();
  for (const [name, value] of moduleResultState.env) {
    if (isRuntimeKey(name)) {
      if (!env.has(name)) loadedModules.set(name, value);
    } else if (isBinding(value) && value.get('module')?.name === path) {
      loadedExports.set(name, value);
    }
  }

  for (const [implName, impl] of Object.entries(locatorResult.impls ?? {})) {
    const declared = bindingValueOf(loadedExports.get(implName));
    if (!isVerb(declared)) throw new UseImplNamesNoVerbError({ namespaceName: path, implName: keyword(implName) });
    attachHostImpl(declared, impl);
  }

  const nextEnv = envMerge(env, new Map([...loadedModules, [cacheKey, loadedExports]]));
  const nounName = canonicalTagName(path);
  const isNounModule = path !== ROOT_MODULE_PATH && nodeOf(nextEnv, path) !== null;
  for (const [name, record] of loadedExports) {
    const declared = bindingValueOf(record);
    if (!isNounModule) continue;
    if (isVerb(declared)) resideVerbOn(declared, nounName);
    if (throwSiteSpecOf(name) !== undefined) recordRefusalAddress(name, canonicalTagName(`${path}/${name}`));
  }
  return [loadedExports, nextEnv];
}

// loadTree(callerState, env, path) → the env with the module of a path
// loaded and, down to the nouns of the providers, the modules under it:
// each node the module declared that is no verb asks the locator for
// the module of its own path [D152].
const NOUN_DEPTH = 2;

export async function loadTree(callerState, env, path) {
  const [loadedExports, loadedEnv] = await loadModule(callerState, env, path);
  if (loadedExports === null) return loadedEnv;
  let treeEnv = loadedEnv;
  for (const [name, record] of loadedExports) {
    const childPath = path === ROOT_MODULE_PATH ? name : `${path}/${name}`;
    if (isVerb(bindingValueOf(record)) || childPath.split('/').length > NOUN_DEPTH) continue;
    treeEnv = await loadTree(callerState, treeEnv, childPath);
  }
  return treeEnv;
}

// The module a tag names, loaded, its exports and the env that holds it:
// the module of its path as written, a module of the host's own, else
// the node of the tree the tag addresses.
async function moduleOfTag(state, env, tag) {
  for (const path of new Set([canonicalTagName(tag.name), fullPathOf(env, tag.name)])) {
    const [moduleExports, moduleEnv] = await loadModule(state, env, path);
    if (moduleExports !== null) return [moduleExports, moduleEnv];
  }
  throw new UseNamespaceNotFoundError({ namespaceName: tag });
}

bindScopeWriter('use', async (subject, namespace, names, state) => {
  if (isNull(namespace)) {
    if (!isQMap(subject)) throw new UseSubjectNotMapError(subject);
    return envMerge(state.env, bindingsOf(subject));
  }
  if (!isNull(names)) {
    if (!isTagKeyword(namespace)) throw new UseNamespaceNotTagError({ actualType: typeKeyword(namespace), actualValue: namespace });
    return await useSelected(state, namespace, names);
  }
  if (isTagKeyword(namespace)) {
    const [moduleExports, moduleEnv] = await moduleOfTag(state, state.env, namespace);
    return envMerge(moduleEnv, moduleExports);
  }
  if (isQSet(namespace)) return await useWithoutCollision(state, namespace);
  return await useInOrder(state, namespace);
});

// The scope the modules a vector names leave, a later one shadowing an
// earlier.
async function useInOrder(state, namespaces) {
  let currentEnv = state.env;
  for (const [index, tag] of namespaces.entries()) {
    if (!isTagKeyword(tag)) throw new UseNamespaceElementNotTagError({ index, actualType: typeKeyword(tag) });
    const [moduleExports, moduleEnv] = await moduleOfTag(state, currentEnv, tag);
    currentEnv = envMerge(moduleEnv, moduleExports);
  }
  return currentEnv;
}

async function useWithoutCollision(state, namespaces) {
  const merged = new Map();
  const origins = new Map();
  let accumulatedEnv = state.env;
  for (const tag of namespaces) {
    if (!isTagKeyword(tag)) throw new UseNamespaceElementNotTagError({ index: origins.size, actualType: typeKeyword(tag) });
    const [moduleExports, moduleEnv] = await moduleOfTag(state, accumulatedEnv, tag);
    accumulatedEnv = moduleEnv;
    for (const [name, record] of moduleExports) {
      if (merged.has(name)) {
        throw new UseNamespaceCollisionError({ collidingName: name, namespaces: [origins.get(name), tag.literal] });
      }
      merged.set(name, record);
      origins.set(name, tag.literal);
    }
  }
  return envMerge(accumulatedEnv, merged);
}

async function useSelected(state, tag, selection) {
  const [moduleExports, moduleEnv] = await moduleOfTag(state, state.env, tag);
  const selected = new Map();
  for (const name of isVec(selection) ? selection : [selection]) {
    const nameText = isKeyword(name) ? name.name : String(name);
    if (!moduleExports.has(nameText)) {
      throw new UseNameNotExportedError({ namespaceName: tag.literal, exportName: nameText });
    }
    selected.set(nameText, moduleExports.get(nameText));
  }
  return envMerge(moduleEnv, selected);
}

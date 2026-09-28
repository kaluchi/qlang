// `use`, the loader, a verb of any value whose primitive writes the scope
// of its call [D113]; its forms are told by its page, `::any/use | doc`.

import { bindScopeWriter } from '../primitives.mjs';
import { nestState, envMerge } from '../state.mjs';
import { parse as parseSource } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import {
  isQMap, isKeyword, isVec, isQSet, isNull, isBinding, isVerb, keyword, makeBinding, bindingValueOf, resideVerbOn,
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

bindScopeWriter('use', async (subject, namespace, names, state) => {
  if (isNull(namespace)) {
    if (!isQMap(subject)) throw new UseSubjectNotMapError(subject);
    return envMerge(state.env, bindingsOf(subject));
  }
  if (!isNull(names)) {
    if (!isKeyword(namespace)) throw new UseNamespaceNotKeywordError({ actualType: typeKeyword(namespace), actualValue: namespace });
    return await importSelectiveNamespace(state, namespace, names);
  }
  if (isKeyword(namespace)) return await importSingleNamespace(state, namespace);
  if (isQSet(namespace)) return await importCollisionStrictNamespaces(state, namespace);
  return await importOrderedNamespaces(state, namespace);
});

// The records a module exports and the env that holds its export map
// from then on. A module is read once: from the export map a load left,
// from a map a host bound under the bare name, or through the host's
// locator, which hands its source and the implementations of its verbs.
// The source runs one frame below the caller, so a module that loads
// itself meets the depth budget.
async function resolveNamespaceEnv(callerState, outerEnv, nsKeyword) {
  const cacheKey = moduleNamespaceKey(nsKeyword.name);
  if (outerEnv.has(cacheKey)) return [outerEnv.get(cacheKey), outerEnv];

  // Any other binding under the bare name, one a step declared among
  // them, is a name and no module.
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

  // A module exports the records its steps wrote, every key it added or
  // bound again [D63].
  const moduleAst = parseSource(locatorResult.source, { uri: nsKeyword.name });
  const moduleEvalState = nestState(callerState, outerEnv, outerEnv);
  const moduleResultState = await evalAst(moduleAst, moduleEvalState);

  const loadedExports = new Map();
  for (const [exportKey, exportVal] of moduleResultState.env) {
    if (!outerEnv.has(exportKey) || outerEnv.get(exportKey) !== exportVal) {
      loadedExports.set(exportKey, exportVal);
    }
  }

  // A host's refusals take the facts their throw sites recorded, as the
  // core's do at bootstrap.
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
  return envMerge(updatedEnv, moduleEnv);
}

// The scope the modules a vector names leave, loaded in order, a later
// one shadowing an earlier: the catalog loads so from its root [D113].
export async function importOrderedNamespaces(state, namespaces) {
  let currentEnv = state.env;
  for (let i = 0; i < namespaces.length; i++) {
    const ns = namespaces[i];
    if (!isKeyword(ns)) {
      throw new UseNamespaceElementNotKeywordError({ index: i, actualType: typeKeyword(ns) });
    }
    const [moduleEnv, updatedEnv] = await resolveNamespaceEnv(state, currentEnv, ns);
    currentEnv = envMerge(updatedEnv, moduleEnv);
  }
  return currentEnv;
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
  return envMerge(accumulatedEnv, merged);
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
  return envMerge(updatedEnv, filtered);
}

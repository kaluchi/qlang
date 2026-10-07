// The tree of names [D152]: every node is a binding a module declared,
// the binding `x` of the module of the path `P` being the node `::P/x`;
// the root module binds the providers, the language's module `qlang`
// its nouns and the pages of its concepts, and the module of a noun its
// verbs, refusals and members. A tag name is the address of a node, read
// nearest first: the scope's own binding of a name of one segment, then
// a provider's node for a path that starts with a provider, then the
// language's. A verb declared in the module of a noun resides on that
// noun [D72], and a walk of a subject's tags finds its verbs there [D34].

import {
  isBinding, isQMap, isSpec, isVec, isVerb, isTagKeyword, isTaggedInstance, isValueClass, makeSet, makeTagKeyword,
  typeKeyword, bindingValueOf, TAG_HEADER_SYMBOL
} from '../types.mjs';
import {
  canonicalTagName, isModuleKey, isRuntimeKey, moduleKey, MODULE_KEY_PREFIX
} from '../env-keys.mjs';
import { isContract } from './verb.mjs';
import { moduleDerivedOf } from '../state.mjs';

// The path of the root module, which binds the providers, and of the
// language's own.
export const ROOT_MODULE_PATH = '';
export const LANGUAGE_PATH = 'qlang';

const ANY_KIND_NAME = 'any';
const TAGGED_KIND_NAME = 'tagged';

// The export maps of an env's modules by path, read once per env.
function indexModules(env) {
  const exportsByPath = new Map();
  for (const [envKey, exportsMap] of env) {
    if (isModuleKey(envKey) && isQMap(exportsMap)) exportsByPath.set(envKey.slice(MODULE_KEY_PREFIX.length), exportsMap);
  }
  return exportsByPath;
}

function modulesOf(env) {
  return moduleDerivedOf(env, indexModules);
}

// exportsOfModule(env, path) → the bindings the module of a path
// declared, by name, or null for a module not loaded.
export function exportsOfModule(env, path) {
  const exportsMap = env.get(moduleKey(path));
  return isQMap(exportsMap) ? exportsMap : null;
}

// The providers the root binds, the language among them.
function isProvider(env, segment) {
  return exportsOfModule(env, ROOT_MODULE_PATH)?.has(segment) === true;
}

// fullPathOf(env, tagName) → the path of the node a tag name addresses
// from the root: a provider's path as written, and any other under the
// language, written short, `::number` for `::qlang/number`.
export function fullPathOf(env, tagName) {
  const name = canonicalTagName(tagName);
  if (name === LANGUAGE_PATH) return LANGUAGE_PATH;
  const firstSegment = name.split('/')[0];
  if (firstSegment !== LANGUAGE_PATH && isProvider(env, firstSegment)) return name;
  return `${LANGUAGE_PATH}/${name}`;
}

// The module of a path and the name of its node.
function splitPath(path) {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? [ROOT_MODULE_PATH, path] : [path.slice(0, cut), path.slice(cut + 1)];
}

// The kind of the scope a name of one segment reads first: one a query,
// a session or a `use` declared, a binding whose value is a spec.
function scopeRecordOf(env, tagName) {
  if (tagName.includes('/') || isRuntimeKey(tagName)) return null;
  const entry = env.get(tagName);
  return isBinding(entry) && isSpec(bindingValueOf(entry)) ? entry : null;
}

// nodeOf(env, tagName) → the record of the node a tag name addresses,
// or null: the scope's own binding first, then the tree's.
export function nodeOf(env, tagName) {
  const scopeRecord = scopeRecordOf(env, canonicalTagName(tagName));
  if (scopeRecord !== null) return scopeRecord;
  const [modulePath, name] = splitPath(fullPathOf(env, tagName));
  const record = exportsOfModule(env, modulePath)?.get(name);
  return isBinding(record) ? record : null;
}

// The module that serves what lies under a noun, or null.
function exportsUnder(env, nounName) {
  return exportsOfModule(env, fullPathOf(env, nounName));
}

// A noun: a node whose module serves what lies under it.
export function isNoun(env, tagName) {
  return exportsUnder(env, tagName) !== null;
}

// The record of the verb of `verbName` that resides on a kind, or null.
function residenceOf(env, kindName, verbName) {
  const record = exportsUnder(env, kindName)?.get(verbName);
  return record !== undefined && isVerb(bindingValueOf(record)) ? record : null;
}

// The verbs that reside on a kind, by name, a contract among them.
function* residencesOnKind(env, kindName) {
  const exportsMap = exportsUnder(env, kindName);
  if (exportsMap === null) return;
  for (const [name, record] of exportsMap) {
    if (isVerb(bindingValueOf(record))) yield [name, record];
  }
}

// The kinds a verb is looked for on, from the outside in [D34]: the kind
// of the value, the kind of every tagged value after a tag [D78], the
// payload beneath a tag over a value, the kind of a vector or a map
// beneath a tag of its own, and, after the kind of tag names, the noun a
// tag name names [D88].
function* kindsOfWalk(subject) {
  let value = subject;
  for (;;) {
    yield typeKeyword(value).name;
    if (isTagKeyword(value)) {
      yield value.name;
      return;
    }
    if (isTaggedInstance(value)) yield TAGGED_KIND_NAME;
    if (isValueClass(value, 'taggedInstance')) {
      value = value.payload;
      continue;
    }
    if (value?.[TAG_HEADER_SYMBOL] !== undefined && isVec(value)) yield 'vec';
    else if (value?.[TAG_HEADER_SYMBOL] !== undefined && isQMap(value)) yield 'map';
    return;
  }
}

// residenceOnSubject(env, verbName, subject) → the record of the verb of
// `verbName` the walk of the subject's tags reaches, the one on
// `::qlang/any` last, where a contract answers for the kinds it leaves,
// or null [D72].
export function residenceOnSubject(env, verbName, subject) {
  for (const kindName of kindsOfWalk(subject)) {
    const record = residenceOf(env, kindName, verbName);
    if (record !== null) return record;
  }
  return residenceOf(env, ANY_KIND_NAME, verbName);
}

// The nouns of the tree whose modules are loaded, each by the name it is
// written by, the root's providers and the language apart.
function* loadedNouns(env) {
  for (const path of modulesOf(env).keys()) {
    if (path === ROOT_MODULE_PATH) continue;
    yield canonicalTagName(path);
  }
}

// residencesOf(env, verbName) → the verbs of a name that reside on the
// nouns of the tree, each with its kind, the contract on `any` apart:
// what a contract answers for.
export function residencesOf(env, verbName) {
  const residences = [];
  for (const kindName of loadedNouns(env)) {
    if (kindName === ANY_KIND_NAME) continue;
    const record = residenceOf(env, kindName, verbName);
    if (record !== null) residences.push([kindName, record]);
  }
  return residences;
}

// The member a noun holds under a name that is no verb of it, or null
// [D117].
export function nounMemberOf(env, kindName, memberName) {
  const record = exportsUnder(env, kindName)?.get(memberName);
  return isBinding(record) && !isVerb(bindingValueOf(record)) ? record : null;
}

// The bindings the scope holds, the names the query, the session and a
// `use` wrote, the keys of the runtime's own apart [D61].
export function scopeBindingsOf(env) {
  const scopeBindings = new Map();
  for (const [name, value] of env) {
    if (!isRuntimeKey(name)) scopeBindings.set(name, value);
  }
  return scopeBindings;
}

// The addresses where the verbs of a name live, one for each kind a verb
// of that name serves, any value among them when the verb there has a
// body, which a refusal of the name hands on [D62].
export function addressesOf(env, verbName) {
  const addresses = [];
  for (const [kindName] of residencesOf(env, verbName)) addresses.push(makeTagKeyword(`${kindName}/${verbName}`));
  const onAnyValue = residenceOf(env, ANY_KIND_NAME, verbName);
  if (onAnyValue !== null && !isContract(bindingValueOf(onAnyValue))) addresses.push(makeTagKeyword(`${ANY_KIND_NAME}/${verbName}`));
  return makeSet(addresses);
}

// The addresses where a reader finds the pages of a name: those of its
// verbs, and the contract on any value, whose page holds for every verb
// of the name [D137].
export function pageAddressesOf(env, verbName) {
  const onAnyValue = residenceOf(env, ANY_KIND_NAME, verbName);
  if (onAnyValue === null || !isContract(bindingValueOf(onAnyValue))) return addressesOf(env, verbName);
  return makeSet([...addressesOf(env, verbName), makeTagKeyword(`${ANY_KIND_NAME}/${verbName}`)]);
}

// The verbs a value of the kinds reaches by name, each with its address,
// from the outside in [D34]: those that reside on each kind, then those
// of any value that have a body, a contract there answering only
// through its residences.
export function verbsReaching(env, kindNames) {
  const reached = new Map();
  for (const kindName of [...kindNames, ANY_KIND_NAME]) {
    for (const [name, record] of residencesOnKind(env, kindName)) {
      const verb = bindingValueOf(record);
      if (reached.has(name) || (kindName === ANY_KIND_NAME && isContract(verb))) continue;
      reached.set(name, { address: makeTagKeyword(`${kindName}/${name}`), verb });
    }
  }
  return reached;
}

// namesUnder(env, tagName) → the nodes under a noun, every binding its
// module declared, its kinds, verbs, refusals and pages [D152].
export function namesUnder(env, tagName) {
  const path = fullPathOf(env, tagName);
  const exportsMap = exportsOfModule(env, path);
  if (exportsMap === null) return makeSet([]);
  return makeSet([...exportsMap.keys()].map(name => makeTagKeyword(`${path}/${name}`)));
}

// The names of every node of the tree, by address, which a guessed tag
// name is held against [D118].
export function nodeAddresses(env) {
  const addresses = [];
  for (const [path, exportsMap] of modulesOf(env)) {
    for (const name of exportsMap.keys()) addresses.push(canonicalTagName(path === ROOT_MODULE_PATH ? name : `${path}/${name}`));
  }
  return addresses;
}

// The names the verbs of the tree go by, which a guessed name of a step
// is held against beside the scope's [D118].
export function verbNames(env) {
  const names = new Set();
  for (const exportsMap of modulesOf(env).values()) {
    for (const [name, record] of exportsMap) if (isVerb(bindingValueOf(record))) names.add(name);
  }
  return names;
}

// The verb a tag name addresses, what its module declared, and the
// record its declaration wrote, or null when the address names none.
export function addressedVerb(env, tagName) {
  const [modulePath, verbName] = splitPath(fullPathOf(env, tagName));
  const record = exportsOfModule(env, modulePath)?.get(verbName);
  if (record === undefined || !isVerb(bindingValueOf(record))) return null;
  return { verbName, descriptor: bindingValueOf(record), record };
}

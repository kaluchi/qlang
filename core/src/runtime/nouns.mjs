// The nouns a session can reach and the verbs that live on a kind
// [D61], [D62], read from what the providers declared. A provider's
// noun is a tag binding it declared with the `::builtin` shape, the
// refusals of its sites apart; the verbs of a kind are the verbs a
// provider exported whose subject names the kind, a subject of any value
// or of any tagged value naming `::qlang/any`. A tag name that no tag
// binds is an address from the root of the tree of names, the path of a
// kind and the name of a verb that lives on it, `::vec/count`; a verb
// has no address of its own. A verb declared in the module of a noun,
// the module named by the noun's path, resides on that noun [D72].

import {
  isBinding, isQMap, isVec, isVerb, isTagKeyword, isTaggedInstance, isValueClass, makeSet, makeTagKeyword, residenceOfVerb,
  typeKeyword, bindingValueOf, isBuiltinDescriptor, TAG_HEADER_SYMBOL
} from '../types.mjs';
import {
  isTagBindingName, stripTagBindingPrefix, canonicalTagName, tagBindingKey, isModuleNamespaceKey,
  isRuntimeKey, moduleNamespaceKey, MODULE_NAMESPACE_PREFIX
} from '../env-keys.mjs';
import { isContract } from './verb.mjs';
import { namespaceDerivedOf } from '../state.mjs';

const ROOT_NOUN_NAME = 'qlang';

// A refusal is a tag whose declaration names the category of its
// failure, stamped from the site that raises it or written in the
// catalog, `::ParseError` and `::ForeignFailureError` among them;
// every other tag a provider declares and exports is a noun, while a
// tag the query or the session declares stays its own. An entry of the
// scope or of an export map is the record of its binding [D63].
function isProviderNoun(env, envKey) {
  return isTagBindingName(envKey) && isProviderBinding(env, envKey)
    && !bindingValueOf(env.get(envKey)).has('category');
}

// The export maps of an env's providers by module name, and the records
// each name is exported under, read once per env [D63].
function indexProviders(env) {
  const exports = [];
  const recordsByName = new Map();
  for (const [envKey, exportsMap] of env) {
    if (!isModuleNamespaceKey(envKey) || !isQMap(exportsMap)) continue;
    exports.push([envKey.slice(MODULE_NAMESPACE_PREFIX.length), exportsMap]);
    for (const [name, record] of exportsMap) {
      if (!recordsByName.has(name)) recordsByName.set(name, new Set());
      recordsByName.get(name).add(record);
    }
  }
  return { exports, recordsByName };
}

function providerExports(env) {
  return namespaceDerivedOf(env, indexProviders).exports;
}

const ANY_KIND_NAME = 'any';
const TAGGED_KIND_NAME = 'tagged';

// The module of a noun of the core is named by its path, `qlang/number`
// for the kind `::number` [D72].
function nounModuleName(kindName) {
  return `qlang/${kindName}`;
}

function exportsOfNoun(env, kindName) {
  const exportsMap = env.get(moduleNamespaceKey(nounModuleName(kindName)));
  return isQMap(exportsMap) ? exportsMap : null;
}

// The record of the verb of `verbName` that resides on a kind, or null.
function residenceOf(env, kindName, verbName) {
  const record = exportsOfNoun(env, kindName)?.get(verbName);
  return record !== undefined && isVerb(bindingValueOf(record)) ? record : null;
}

// The verbs that reside on a kind, by name, a contract among them.
function* residencesOnKind(env, kindName) {
  const exportsMap = exportsOfNoun(env, kindName);
  if (exportsMap === null) return;
  for (const [name, record] of exportsMap) {
    if (!isTagBindingName(name) && isVerb(bindingValueOf(record))) yield [name, record];
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

// residencesOf(env, verbName) → the verbs of a name that reside on the
// nouns of its providers, each with its kind, the contract on `any`
// apart: what a contract answers for.
export function residencesOf(env, verbName) {
  const residences = [];
  for (const [moduleName, exportsMap] of providerExports(env)) {
    const kindName = canonicalTagName(moduleName);
    const record = exportsMap.get(verbName);
    if (record === undefined || !isVerb(bindingValueOf(record)) || kindName === ANY_KIND_NAME) continue;
    if (moduleName === nounModuleName(kindName) && env.has(tagBindingKey(kindName))) residences.push([kindName, record]);
  }
  return residences;
}

export function isNoun(env, tagName) {
  return isProviderNoun(env, tagBindingKey(tagName));
}

// A verb or a tag a provider exports under a name stays with its
// provider, read through the noun it lives on, a verb residing on one
// among them [D72]; the scope holds what the query, the session and a
// module's `use` wrote under a name of their own [D62], [D63].
export function isProviderBinding(env, name) {
  const entry = env.get(name);
  const declared = bindingValueOf(entry);
  if (!isBuiltinDescriptor(declared) && !(isVerb(declared) && residenceOfVerb(declared) !== null)) return false;
  return namespaceDerivedOf(env, indexProviders).recordsByName.get(name)?.has(entry) === true;
}

// A declaration a noun's module makes that is no verb is a member of the
// noun, read through it, `::qlang | doc :pipeline`, and no name of a
// reader's scope [D117].
export function isNounMember(env, name) {
  const entry = env.get(name);
  if (!isBinding(entry) || isVerb(bindingValueOf(entry)) || isTagBindingName(name)) return false;
  const moduleName = entry.get('module')?.name;
  return typeof moduleName === 'string' && moduleName.startsWith(`${ROOT_NOUN_NAME}/`)
    && isNoun(env, moduleName.slice(ROOT_NOUN_NAME.length + 1));
}

// The member a noun holds under a name that is no verb of it, or null.
export function nounMemberOf(env, kindName, memberName) {
  const record = exportsOfNoun(env, kindName)?.get(memberName);
  return isBinding(record) && !isVerb(bindingValueOf(record)) ? record : null;
}

// The bindings the scope holds, the names the query, the session and a
// module's `use` wrote, with the verbs, the tags and the members of the
// providers and the keys of the runtime's own apart [D61], [D117].
export function scopeBindingsOf(env) {
  const scopeBindings = new Map();
  for (const [name, value] of env) {
    if (!isRuntimeKey(name) && !isProviderBinding(env, name) && !isNounMember(env, name)) scopeBindings.set(name, value);
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

// The nouns under a noun, the whole set for the core's own noun.
function nounsUnder(env, tagName) {
  const under = canonicalTagName(tagName);
  const nouns = [];
  for (const envKey of env.keys()) {
    if (!isProviderNoun(env, envKey)) continue;
    const nounName = stripTagBindingPrefix(envKey);
    const beneath = under === ROOT_NOUN_NAME ? nounName !== ROOT_NOUN_NAME : nounName.startsWith(`${under}/`);
    if (beneath) nouns.push(makeTagKeyword(nounName));
  }
  return makeSet(nouns);
}

// The verbs of a kind by their addresses, which the axes follow, where a
// keyword would name a binding of the reader's scope [D62].
export function verbsOfKind(env, tagName) {
  const kindName = canonicalTagName(tagName);
  const addresses = [];
  for (const [name] of residencesOnKind(env, kindName)) addresses.push(makeTagKeyword(`${kindName}/${name}`));
  return makeSet(addresses);
}

// The refusals a query provokes on a noun: its own, then those of each
// verb that lives on it, in the order of the verbs [D64], a verb's read by
// `refusalsOfVerb`, each listed once, since the refusal of a kind guards
// the places of several verbs.
export function refusalsOfNoun(env, tagName, ownRefusals, refusalsOfVerb) {
  const verbRefusals = [...verbsOfKind(env, tagName)].flatMap(address => refusalsOfVerb(addressedVerb(env, address.name).descriptor));
  const refusalsByName = new Map([...ownRefusals, ...verbRefusals].map(refusal => [refusal.name, refusal]));
  return Object.freeze([...refusalsByName.values()]);
}

// What lies below a noun in the tree of names [D62]: the nouns under its
// path and the addresses of the verbs that live on it, so `::number`
// answers `::number/add` among its own and `::qlang`, with no verb of
// its own, the nouns of the providers.
export function namesUnder(env, tagName) {
  return makeSet([...nounsUnder(env, tagName), ...verbsOfKind(env, tagName)]);
}

// The verb a tag name addresses, what its provider declared, and the
// record its declaration wrote, or null when the address names none. A tag name comes written short, so the path of an
// address under the core starts at its kind.
export function addressedVerb(env, tagName) {
  const cut = tagName.lastIndexOf('/');
  if (cut < 0) return null;
  const verbName = tagName.slice(cut + 1);
  const kindName = tagName.slice(0, cut);
  const residence = residenceOf(env, kindName, verbName);
  return residence === null ? null : { verbName, descriptor: bindingValueOf(residence), record: residence };
}

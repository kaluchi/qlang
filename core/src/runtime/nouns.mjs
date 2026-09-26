// The nouns a session can reach and the verbs that live on a kind
// [D61], [D62], read from what the providers declared. A provider's
// noun is a tag binding it declared with the `::builtin` shape, the
// refusals of its sites apart; the verbs of a kind are the operands a
// provider exported whose subject names the kind, a subject of any value
// or of any tagged value naming `::qlang/any`. A tag name that no tag
// binds is an address from the root of the tree of names, the path of a
// kind and the name of a verb that lives on it, `::vec/count`; a verb
// has no address of its own. A verb declared in the module of a noun,
// the module named by the noun's path, resides on that noun [D72].

import {
  isQMap, isVec, isVerb, isTaggedInstance, isValueClass, makeSet, makeTagKeyword, residenceOfVerb,
  typeKeyword, bindingValueOf, TAG_HEADER_SYMBOL
} from '../types.mjs';
import {
  isTagBindingName, stripTagBindingPrefix, canonicalTagName, tagBindingKey, isModuleNamespaceKey,
  isRuntimeKey, moduleNamespaceKey, MODULE_NAMESPACE_PREFIX
} from '../env-keys.mjs';

const ROOT_NOUN_NAME = 'qlang';

function carriesBuiltinShape(value) {
  return isQMap(value) && value[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

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

function* providerExports(env) {
  for (const [envKey, exportsMap] of env) {
    if (isModuleNamespaceKey(envKey) && isQMap(exportsMap)) {
      yield [envKey.slice(MODULE_NAMESPACE_PREFIX.length), exportsMap];
    }
  }
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
// payload beneath a tag over a value, and the kind of a vector or a map
// beneath a tag of its own.
function* kindsOfWalk(subject) {
  let value = subject;
  for (;;) {
    yield typeKeyword(value).name;
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

// A descriptor, the loader's alone among the operands of the core, takes
// any subject and lives beneath every kind [D79].
const DESCRIPTOR_KINDS = new Set([ANY_KIND_NAME]);

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
  if (!carriesBuiltinShape(declared) && !(isVerb(declared) && residenceOfVerb(declared) !== null)) return false;
  for (const [, exportsMap] of providerExports(env)) {
    if (exportsMap.get(name) === entry) return true;
  }
  return false;
}

// The bindings the scope holds, the names the query, the session and a
// module's `use` wrote, with the verbs and the tags of the providers and
// the keys of the runtime's own apart [D61].
export function scopeBindingsOf(env) {
  const scopeBindings = new Map();
  for (const [name, value] of env) {
    if (!isRuntimeKey(name) && !isProviderBinding(env, name)) scopeBindings.set(name, value);
  }
  return scopeBindings;
}

// The addresses where the verbs of a name live, one for each kind a verb
// of that name serves, which a refusal of the name hands on [D62].
export function addressesOf(env, verbName) {
  const addresses = [];
  for (const [, exportsMap] of providerExports(env)) {
    const descriptor = bindingValueOf(exportsMap.get(verbName));
    if (!carriesBuiltinShape(descriptor) || isTagBindingName(verbName)) continue;
    for (const kindName of DESCRIPTOR_KINDS) addresses.push(makeTagKeyword(`${kindName}/${verbName}`));
  }
  for (const [kindName] of residencesOf(env, verbName)) addresses.push(makeTagKeyword(`${kindName}/${verbName}`));
  return makeSet(addresses);
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
  for (const [, exportsMap] of providerExports(env)) {
    for (const [name, entry] of exportsMap) {
      const descriptor = bindingValueOf(entry);
      if (!isTagBindingName(name) && carriesBuiltinShape(descriptor) && DESCRIPTOR_KINDS.has(kindName)) {
        addresses.push(makeTagKeyword(`${kindName}/${name}`));
      }
    }
  }
  for (const [name] of residencesOnKind(env, kindName)) addresses.push(makeTagKeyword(`${kindName}/${name}`));
  return makeSet(addresses);
}

// The refusals a query provokes on a noun: its own, then those of each
// verb that lives on it, in the order of the verbs [D64], a verb's read by
// `refusalsOfVerb`, each listed once, since the refusal of a kind guards
// the places of several verbs; a descriptor a module assembled from
// data, its `:impl` a handle of the core, names none.
export function refusalsOfNoun(env, tagName, ownRefusals, refusalsOfVerb) {
  const verbRefusals = [...verbsOfKind(env, tagName)].flatMap(address => {
    const declared = addressedVerb(env, address.name).descriptor;
    return isVerb(declared) ? refusalsOfVerb(declared) : declared.get('throws') ?? [];
  });
  return Object.freeze([...new Set([...ownRefusals, ...verbRefusals])]);
}

// What lies below a noun in the tree of names [D62]: the nouns under its
// path and the addresses of the verbs that live on it, so `::number`
// answers `::number/add` among its own and `::qlang`, with no verb of
// its own, the nouns of the providers.
export function namesUnder(env, tagName) {
  return makeSet([...nounsUnder(env, tagName), ...verbsOfKind(env, tagName)]);
}

// The verb a tag name addresses, what its provider declared, a verb or
// a descriptor, and the record its declaration wrote, or null when the
// address names none. A tag name comes written short, so the path of an
// address under the core starts at its kind.
export function addressedVerb(env, tagName) {
  const cut = tagName.lastIndexOf('/');
  if (cut < 0) return null;
  const verbName = tagName.slice(cut + 1);
  const kindName = tagName.slice(0, cut);
  const residence = residenceOf(env, kindName, verbName);
  if (residence !== null) return { verbName, descriptor: bindingValueOf(residence), record: residence };
  for (const [, exportsMap] of providerExports(env)) {
    const record = exportsMap.get(verbName);
    const descriptor = bindingValueOf(record);
    if (carriesBuiltinShape(descriptor) && DESCRIPTOR_KINDS.has(kindName)) {
      return { verbName, descriptor, record };
    }
  }
  return null;
}

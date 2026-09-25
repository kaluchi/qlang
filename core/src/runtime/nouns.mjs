// The nouns a session can reach and the verbs that live on a kind
// [D61], [D62], read from what the providers declared. A provider's
// noun is a tag binding it declared with the `::builtin` shape, the
// refusals of its sites apart; the verbs of a kind are the operands a
// provider exported whose subject names the kind, a subject of any value
// or of any tagged value naming `::qlang/any`. A tag name that no tag
// binds is an address from the root of the tree of names, the path of a
// kind and the name of a verb that lives on it, `::vec/count`; a verb
// has no address of its own.

import {
  isQMap, isVec, isValueClass, makeSet, makeTagKeyword, keyword, typeKeyword, TAG_HEADER_SYMBOL
} from '../types.mjs';
import {
  isTagBindingName, stripTagBindingPrefix, canonicalTagName, tagBindingKey, isModuleNamespaceKey,
  isRuntimeKey, MODULE_NAMESPACE_PREFIX
} from '../env-keys.mjs';

const ROOT_NOUN_NAME = 'qlang';

function carriesBuiltinShape(value) {
  return isQMap(value) && value[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

// A refusal is a tag whose declaration names the category of its
// failure, stamped from the site that raises it or written in the
// catalog, `::ParseError` and `::ForeignFailureError` among them;
// every other tag a provider declares is a noun.
function isProviderNoun(envKey, value) {
  return isTagBindingName(envKey) && carriesBuiltinShape(value) && !value.has('category');
}

function* providerExports(env) {
  for (const [envKey, exportsMap] of env) {
    if (isModuleNamespaceKey(envKey) && isQMap(exportsMap)) {
      yield [envKey.slice(MODULE_NAMESPACE_PREFIX.length), exportsMap];
    }
  }
}

const SUBJECTS_BENEATH_EVERY_KIND = new Set(['any', 'taggedInstance']);

// A verb that declares no subject takes any [D45].
function subjectKindsOf(descriptor) {
  const subject = descriptor.get('subject') ?? keyword('any');
  const named = isVec(subject) ? subject : [subject];
  return new Set(named.map(kindKeyword => (SUBJECTS_BENEATH_EVERY_KIND.has(kindKeyword.name) ? 'any' : kindKeyword.name)));
}

function servesKindOf(descriptor, value) {
  const kinds = subjectKindsOf(descriptor);
  return kinds.has('any') || kinds.has(typeKeyword(value).name);
}

// The value a verb takes from its subject, walking the subject's tags
// from the outside in [D34]: the subject itself when the verb serves its
// kind, and past a tag the verb does not serve the value that tag wraps,
// with the tags passed on the way, so `::Box#[3 1] | count` counts the
// set. A tag a vector or a map carries rides the value itself, which a
// verb of vectors or of maps reads as it is.
export function subjectServedBy(descriptor, subject) {
  const passedTags = [];
  let served = subject;
  while (isValueClass(served, 'taggedInstance') && !servesKindOf(descriptor, served)) {
    passedTags.push(served.tag);
    served = served.payload;
  }
  return { served, passedTags };
}

export function isNoun(env, tagName) {
  const envKey = tagBindingKey(tagName);
  return isProviderNoun(envKey, env.get(envKey));
}

// A verb or a tag a provider exports under a name stays with its
// provider, read through the noun it lives on; the scope holds what the
// query, the session and a module's `use` wrote under a name of their
// own [D62], [D63].
export function isProviderBinding(env, name) {
  const value = env.get(name);
  if (!carriesBuiltinShape(value)) return false;
  for (const [, exportsMap] of providerExports(env)) {
    if (exportsMap.get(name) === value) return true;
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
    const descriptor = exportsMap.get(verbName);
    if (!carriesBuiltinShape(descriptor) || isTagBindingName(verbName)) continue;
    for (const kindName of subjectKindsOf(descriptor)) addresses.push(makeTagKeyword(`${kindName}/${verbName}`));
  }
  return makeSet(addresses);
}

// The nouns under a noun, the whole set for the core's own noun.
function nounsUnder(env, tagName) {
  const under = canonicalTagName(tagName);
  const nouns = [];
  for (const [envKey, value] of env) {
    if (!isProviderNoun(envKey, value)) continue;
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
    for (const [name, descriptor] of exportsMap) {
      if (!isTagBindingName(name) && carriesBuiltinShape(descriptor) && subjectKindsOf(descriptor).has(kindName)) {
        addresses.push(makeTagKeyword(`${kindName}/${name}`));
      }
    }
  }
  return makeSet(addresses);
}

// The refusals a query provokes on a noun: its own, then those of each
// verb that lives on it, in the order of the verbs [D64]. A refusal
// guards one site, so none repeats; a descriptor a module assembled
// from data, its `:impl` a handle of the core, names none.
export function refusalsOfNoun(env, tagName, ownRefusals) {
  const verbRefusals = [...verbsOfKind(env, tagName)]
    .flatMap(address => addressedVerb(env, address.name).descriptor.get('throws') ?? []);
  return Object.freeze([...ownRefusals, ...verbRefusals]);
}

// What lies below a noun in the tree of names [D62]: the nouns under its
// path and the addresses of the verbs that live on it, so `::number`
// answers `::number/add` among its own and `::qlang`, with no verb of
// its own, the nouns of the providers.
export function namesUnder(env, tagName) {
  return makeSet([...nounsUnder(env, tagName), ...verbsOfKind(env, tagName)]);
}

// The verb a tag name addresses, with the module that declares it, or
// null when the address names none. A tag name comes written short, so
// the path of an address under the core starts at its kind.
export function addressedVerb(env, tagName) {
  const cut = tagName.lastIndexOf('/');
  if (cut < 0) return null;
  const verbName = tagName.slice(cut + 1);
  const kindName = tagName.slice(0, cut);
  for (const [uri, exportsMap] of providerExports(env)) {
    const descriptor = exportsMap.get(verbName);
    if (carriesBuiltinShape(descriptor) && subjectKindsOf(descriptor).has(kindName)) {
      return { verbName, descriptor, uri };
    }
  }
  return null;
}

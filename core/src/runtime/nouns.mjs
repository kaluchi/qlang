// The nouns a session can reach and the verbs that live on a kind
// [D61], [D62], read from what the providers declared. A provider's
// noun is a tag binding it declared with the `::builtin` shape, the
// refusals of its sites apart; the verbs of a kind are the operands a
// provider exported whose subject names the kind, a subject of any value
// or of any tagged value naming `::qlang/any`. A tag name that no tag
// binds is an address from the root of the tree of names, the path of a
// kind and the name of a verb that lives on it, `::vec/count`; a verb
// has no address of its own.

import { isQMap, isVec, makeSet, makeTagKeyword, keyword, TAG_HEADER_SYMBOL } from '../types.mjs';
import {
  isTagBindingName, stripTagBindingPrefix, canonicalTagName, tagBindingKey, isModuleNamespaceKey,
  MODULE_NAMESPACE_PREFIX
} from '../env-keys.mjs';
const ROOT_NOUN_NAME = 'qlang';

function carriesBuiltinShape(value) {
  return isQMap(value) && value[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

// A refusal is a tag whose declaration names the category of its
// failure, stamped from the site that raises it or written in the
// catalog, `::ParseError` and `::Error` among them; every other tag a
// provider declares is a noun.
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

export function isNoun(env, tagName) {
  const envKey = tagBindingKey(tagName);
  return isProviderNoun(envKey, env.get(envKey));
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

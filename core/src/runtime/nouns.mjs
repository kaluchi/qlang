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
  MODULE_NAMESPACE_PREFIX, CORE_KIND_PREFIX
} from '../env-keys.mjs';
import { throwSiteSpecOf } from '../errors.mjs';

const ROOT_NOUN_NAME = 'qlang';

function carriesBuiltinShape(value) {
  return isQMap(value) && value[TAG_HEADER_SYMBOL]?.name === 'builtin';
}

// A refusal is the tag of a site that records its spec where it is
// declared in the host's code; every other tag a provider declares is a
// noun.
function isProviderNoun(envKey, value) {
  return isTagBindingName(envKey) && carriesBuiltinShape(value)
    && throwSiteSpecOf(stripTagBindingPrefix(envKey)) === undefined;
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
export function nounsUnder(env, tagName) {
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

export function verbsOfKind(env, tagName) {
  const kindName = canonicalTagName(tagName);
  const verbNames = new Set();
  for (const [, exportsMap] of providerExports(env)) {
    for (const [name, descriptor] of exportsMap) {
      if (!isTagBindingName(name) && carriesBuiltinShape(descriptor) && subjectKindsOf(descriptor).has(kindName)) {
        verbNames.add(name);
      }
    }
  }
  return Object.freeze([...verbNames].sort().map(name => keyword(name)));
}

// The verb a tag name addresses, with the module that declares it, or
// null when the address names none.
export function addressedVerb(env, tagName) {
  const path = tagName.startsWith(CORE_KIND_PREFIX) ? tagName.slice(CORE_KIND_PREFIX.length) : tagName;
  const cut = path.lastIndexOf('/');
  if (cut < 0) return null;
  const verbName = path.slice(cut + 1);
  const kindName = canonicalTagName(path.slice(0, cut));
  for (const [uri, exportsMap] of providerExports(env)) {
    const descriptor = exportsMap.get(verbName);
    if (carriesBuiltinShape(descriptor) && subjectKindsOf(descriptor).has(kindName)) {
      return { verbName, descriptor, uri };
    }
  }
  return null;
}

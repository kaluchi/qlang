// The names of a scope [D153]: a declaration writes its name, and a name
// with a path, `vec/count`, is the address of the node it declares under
// the noun its path begins with. The root is the scope the host's sources
// declared before the reader's first step, the language's first; the
// reader's declarations stand over it. A tag name reads the node of its
// address, the nearest declaration of it, and a walk of a subject's tags
// finds the verbs declared under each kind it passes [D34], [D72].

import {
  isBinding, isQMap, isVec, isVerb, isTagKeyword, isTaggedInstance, isValueClass, makeSet, makeTagKeyword,
  typeKeyword, bindingValueOf, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { isRuntimeKey, ROOT_KEY } from '../env-keys.mjs';
import { isContract } from './verb.mjs';

const ANY_KIND_NAME = 'any';
const TAGGED_KIND_NAME = 'tagged';

// The noun a name with a path is declared under and its last name,
// `['vec', 'count']`; a name of one segment is under no noun.
export function splitAddress(name) {
  const cut = name.lastIndexOf('/');
  return cut < 0 ? [null, name] : [name.slice(0, cut), name.slice(cut + 1)];
}

// The bindings of a scope by name, the keys of the runtime apart.
function* bindingsOf(env) {
  for (const [name, entry] of env) {
    if (!isRuntimeKey(name) && isBinding(entry)) yield [name, entry];
  }
}

// Whether the binding a scope holds under a name is the root's, which the
// host's sources declared.
export function isRootBinding(env, name) {
  const root = env.get(ROOT_KEY);
  return root !== undefined && root.has(name) && root.get(name) === env.get(name);
}

// nodeOf(env, tagName) → the record of the node a tag name addresses,
// the nearest declaration of its name, or null.
export function nodeOf(env, tagName) {
  const entry = env.get(tagName);
  return isBinding(entry) ? entry : null;
}

// The record of the verb of `verbName` declared under a kind, or null.
function residenceOf(env, kindName, verbName) {
  const record = nodeOf(env, `${kindName}/${verbName}`);
  return record !== null && isVerb(bindingValueOf(record)) ? record : null;
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
// `verbName` the walk of the subject's tags reaches, the one on `::any`
// last, where a contract answers for the kinds it leaves, or null [D72].
export function residenceOnSubject(env, verbName, subject) {
  for (const kindName of kindsOfWalk(subject)) {
    const record = residenceOf(env, kindName, verbName);
    if (record !== null) return record;
  }
  return residenceOf(env, ANY_KIND_NAME, verbName);
}

// residencesOf(env, verbName) → the verbs of a name declared under a
// kind, each with its kind, in the order of their declarations, the
// contract on `any` apart: what a contract answers for.
export function residencesOf(env, verbName) {
  const residences = [];
  for (const [name, record] of bindingsOf(env)) {
    const [kindName, lastName] = splitAddress(name);
    if (kindName === null || kindName === ANY_KIND_NAME || lastName !== verbName) continue;
    if (isVerb(bindingValueOf(record))) residences.push([kindName, record]);
  }
  return residences;
}

// The member a noun holds under a name that is no verb, or null [D117].
export function nounMemberOf(env, nounName, memberName) {
  const record = nodeOf(env, `${nounName}/${memberName}`);
  return record !== null && !isVerb(bindingValueOf(record)) ? record : null;
}

// A noun: a node some declaration names a path under.
export function isNoun(env, tagName) {
  const prefix = `${tagName}/`;
  for (const [name] of bindingsOf(env)) if (name.startsWith(prefix)) return true;
  return false;
}

// The names of a scope, those of one segment: the nouns of the root and
// what the reader declared; a name with a path is a member of its noun
// [D153].
export function scopeNamesOf(env) {
  const scopeNames = new Map();
  for (const [name, record] of bindingsOf(env)) {
    if (splitAddress(name)[0] === null) scopeNames.set(name, record);
  }
  return scopeNames;
}

// The addresses where the verbs of a name live, one for each kind a verb
// of that name serves, any value among them when the verb there has a
// body, which a refusal of the name hands on [D62].
export function addressesOf(env, verbName) {
  const addresses = residencesOf(env, verbName).map(([kindName]) => makeTagKeyword(`${kindName}/${verbName}`));
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
// from the outside in [D34]: those declared under each kind, then those
// of any value that have a body, a contract there answering only
// through its residences.
export function verbsReaching(env, kindNames) {
  const reached = new Map();
  for (const kindName of [...kindNames, ANY_KIND_NAME]) {
    for (const [name, record] of namesUnderOf(env, kindName)) {
      const verb = bindingValueOf(record);
      if (!isVerb(verb) || reached.has(name) || (kindName === ANY_KIND_NAME && isContract(verb))) continue;
      reached.set(name, { address: makeTagKeyword(`${kindName}/${name}`), verb });
    }
  }
  return reached;
}

// The nodes declared one name under a noun, by their last names.
function namesUnderOf(env, nounName) {
  const under = new Map();
  for (const [name, record] of bindingsOf(env)) {
    const [kindName, lastName] = splitAddress(name);
    if (kindName === nounName) under.set(lastName, record);
  }
  return under;
}

// namesUnder(env, tagName) → the nodes declared one name under a noun,
// its verbs, refusals and pages, by address [D62].
export function namesUnder(env, tagName) {
  return makeSet([...namesUnderOf(env, tagName).keys()].map(name => makeTagKeyword(`${tagName}/${name}`)));
}

// The names of every node, which a guessed tag name is held against
// [D118].
export function nodeAddresses(env) {
  return [...bindingsOf(env)].map(([name]) => name);
}

// The names the verbs go by, which a guessed name of a step is held
// against beside the scope's [D118].
export function verbNames(env) {
  const names = new Set();
  for (const [name, record] of bindingsOf(env)) {
    if (isVerb(bindingValueOf(record))) names.add(splitAddress(name)[1]);
  }
  return names;
}

// The verb a name with a path addresses and the record its declaration
// wrote, or null when the address names none.
export function addressedVerb(env, tagName) {
  const record = nodeOf(env, tagName);
  if (record === null || !isVerb(bindingValueOf(record))) return null;
  return { verbName: splitAddress(tagName)[1], descriptor: bindingValueOf(record), record };
}

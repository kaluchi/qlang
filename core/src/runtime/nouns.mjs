// The names of a scope [D153]: a declaration writes its name, and a name
// with a path, `vec/count`, is the address of the node it declares under
// the noun its path names before its last name. The root is the scope the
// host's sources declared before the reader's first step, the language's
// first. A step reads the nearest declaration of its name, the frame of
// the reader's before the root's, and a tag name, an address, the root's
// node of it first, which no reader replaces; a walk of a subject's tags
// finds the verbs residing on each kind it passes [D34], [D72].

import {
  isBinding, isQMap, isSpec, isVec, isVerb, isTagKeyword, isTaggedInstance, isValueClass, makeSet, makeTagKeyword,
  typeKeyword, bindingValueOf, residenceOfVerb, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { rootOf } from '../state.mjs';
import { isContract } from './verb.mjs';

const ANY_KIND_NAME = 'any';
const TAGGED_KIND_NAME = 'tagged';

// The noun a name with a path is declared under and its last name,
// `['vec', 'count']`; a name of one segment is under no noun.
export function splitAddress(name) {
  const cut = name.lastIndexOf('/');
  return cut < 0 ? [null, name] : [name.slice(0, cut), name.slice(cut + 1)];
}

// The bindings of a scope by name: the root's a name of the frame does
// not stand over, then the frame's.
function* bindingsOf(env) {
  for (const [name, entry] of rootOf(env)) if (!env.has(name)) yield [name, entry];
  for (const [name, entry] of env) if (isBinding(entry)) yield [name, entry];
}

// nodeOf(env, tagName) → the record of the node a tag name addresses,
// the root's under that name, else the reader's, or null.
export function nodeOf(env, tagName) {
  const entry = rootOf(env).get(tagName) ?? env.get(tagName);
  return isBinding(entry) ? entry : null;
}

// Whether a record holds a verb residing on a kind.
function residesOn(record, kindName) {
  const value = bindingValueOf(record);
  return isVerb(value) && residenceOfVerb(value) === kindName;
}

// The record of the verb of `verbName` residing on a kind, or null.
function residenceOf(env, kindName, verbName) {
  const record = nodeOf(env, `${kindName}/${verbName}`);
  return record !== null && residesOn(record, kindName) ? record : null;
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
// last, where a contract answers for the kinds it leaves, or null [D72];
// with no subject, the one on `::any` alone.
export function residenceOnSubject(env, verbName, subject) {
  if (subject !== undefined) {
    for (const kindName of kindsOfWalk(subject)) {
      const record = residenceOf(env, kindName, verbName);
      if (record !== null) return record;
    }
  }
  return residenceOf(env, ANY_KIND_NAME, verbName);
}

// bareNameReach(env, name, subject?) → what a bare name reaches, nearest
// first [D62], [D153]: the reader's declaration, the verb residing on a
// kind the walk of the subject reaches, the root's declaration, else the
// one verb of the name residing on a kind, whose head refuses a subject
// of another kind [D156]; `{ record, underKind }`, or null when no record
// answers or verbs of several kinds do.
export function bareNameReach(env, name, subject) {
  if (env.has(name) && isBinding(env.get(name))) return { record: env.get(name), underKind: false };
  const residence = residenceOnSubject(env, name, subject);
  if (residence !== null) return { record: residence, underKind: true };
  if (rootOf(env).has(name)) return { record: rootOf(env).get(name), underKind: false };
  const residences = residencesOf(env, name);
  return residences.length === 1 ? { record: residences[0][1], underKind: true } : null;
}

// residencesOf(env, verbName) → the verbs of a name residing on a kind,
// each with its kind, in the order of their declarations, the contract
// on `any` apart: what a contract answers for.
export function residencesOf(env, verbName) {
  const residences = [];
  for (const [name, record] of bindingsOf(env)) {
    const [kindName, lastName] = splitAddress(name);
    if (kindName === null || kindName === ANY_KIND_NAME || lastName !== verbName) continue;
    if (residesOn(record, kindName)) residences.push([kindName, record]);
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

// readerNamesOf(env) → what the reader declared, by name, the root apart
// [D160].
export function readerNamesOf(env) {
  const readerNames = new Map();
  for (const [name, entry] of env) if (isBinding(entry)) readerNames.set(name, entry);
  return readerNames;
}

// kindNamesOf(env) → the names of one segment whose tag addresses a
// kind, the root's first, as a tag reads them, then the reader's.
export function kindNamesOf(env) {
  const names = [...rootOf(env).keys(), ...[...env.keys()].filter(name => !rootOf(env).has(name))];
  return names.filter(name => typeof name === 'string' && splitAddress(name)[0] === null && isSpec(bindingValueOf(nodeOf(env, name))));
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
      if (!residesOn(record, kindName) || reached.has(name) || (kindName === ANY_KIND_NAME && isContract(verb))) continue;
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


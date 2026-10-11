// The names of a scope [D153]: a declaration writes its name, and a name
// with a path, `vec/count`, is the address of the node it declares under
// the noun its path names before its last name. The root is the scope the
// host's sources declared before the reader's first step, the language's
// first. A step reads the nearest declaration of its name, the frame of
// the reader's before the root's, and a tag name, an address, the root's
// node of it first, which no reader replaces; a walk of a subject's tags
// finds the words residing on each kind it passes [D34], [D164].

import {
  isBinding, isBuiltinDescriptor, isDoc, isHostDeclared, isQMap, isQSet, isQuote, isVec, isTagKeyword, isTaggedInstance,
  isValueClass, makeSet, makeTagKeyword,
  typeKeyword, bindingValueOf, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { rootOf } from '../state.mjs';
import { splitAddress } from '../address.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import { astOfQuote } from '../quote.mjs';

const ANY_KIND_NAME = 'any';
const TAGGED_KIND_NAME = 'tagged';


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

// Whether a record holds a page, which makes its name a label [D166],
// [D168].
export function holdsAPage(record) {
  return isDoc(bindingValueOf(record));
}

// Whether a node is a label, a name declared by its page.
export function isLabel(env, name) {
  return holdsAPage(nodeOf(env, name));
}

// Whether a name stands under a label, where a quote or a host's
// primitive runs on the label's values [D164].
export function isUnderLabel(env, name) {
  const [labelName] = splitAddress(name);
  return labelName !== null && isLabel(env, labelName);
}

// declaresWord(address, runs, isLabelName) → whether a declaration at the
// address whose value runs is a word: a name under a label, the label's
// `construct` apart, which builds the label's values [D164], [D169]; a
// name under such a name is a part of its args and resides nowhere. The
// core asks it of the records of a scope, the language server of the
// declarations of a document.
export function declaresWord(address, runs, isLabelName) {
  const [labelName, lastName] = splitAddress(address);
  return runs && labelName !== null && lastName !== CONSTRUCT_NAME && isLabelName(labelName);
}

export const CONSTRUCT_NAME = 'construct';

// Whether a record holds a word, its value a quote or the descriptor of a
// host's primitive, which run on the label's values.
function residesOn(record, env) {
  return declaresWord(record.get('name').name, isMemberValue(bindingValueOf(record)), labelName => isLabel(env, labelName));
}

// isWord(env, address) → whether the name at the address is a word; a
// word is the label of the args of a call of it [D169], [D173].
export function isWord(env, address) {
  const record = nodeOf(env, address);
  return record !== null && residesOn(record, env);
}

// A value a name under a label holds when it runs on the label's values.
export function isMemberValue(value) {
  return isQuote(value) || (isBuiltinDescriptor(value) && isHostDeclared(value));
}

// Whether a call of the name reads the parts declared under it: a quote
// or a `::builtin{}` under a label, the host's marked as such once its
// source has run [D167].
export function readsParts(env, name) {
  const value = bindingValueOf(nodeOf(env, name));
  return (isQuote(value) || isBuiltinDescriptor(value)) && isUnderLabel(env, name);
}

// answerOf(env, address) → the definition of the answer of the word at the
// address, the name `answer` under it, whose value is a tag or a set of
// tags, `{ address, kinds }`, or null for a word that answers any value
// [D169], [D179].
export function answerOf(env, address) {
  const record = nodeOf(env, `${address}/${ANSWER_NAME}`);
  const kinds = record === null ? null : kindsNamedBy(bindingValueOf(record));
  return kinds === null ? null : { address: record.get('name').name, kinds };
}

const ANSWER_NAME = 'answer';

// subjectOf(env, address) → the kinds the name `subject` under the word at
// the address names, `::tag` for a word of a noun itself, which takes a
// tag name as its subject [D88], or null for a word of the label's values.
export function subjectOf(env, address) {
  const record = nodeOf(env, `${address}/${SUBJECT_NAME}`);
  return record === null ? null : kindsNamedBy(bindingValueOf(record));
}

const SUBJECT_NAME = 'subject';

// invariantsUnder(env, address) → the invariants declared under an
// address, each a name whose value is a quote under `::holds`,
// `[address, query]` in the order of their declarations [D169].
export function invariantsUnder(env, address) {
  return derivedOf(namesUnderOf(env, address), INVARIANTS, under => {
    const invariants = [];
    for (const [, record] of under) {
      const value = bindingValueOf(record);
      if (isInvariant(value)) invariants.push([record.get('name').name, value.payload]);
    }
    return invariants;
  });
}

const INVARIANTS = new WeakMap();

// Whether a value is an invariant, a quote under `::holds`, whose name is
// the refusal of a value that breaks it [D168].
export function isInvariant(value) {
  return isValueClass(value, 'taggedInstance') && value.tag.name === INVARIANT_TAG_NAME && isQuote(value.payload);
}

const INVARIANT_TAG_NAME = 'holds';

// Whether a value is a law, a quote under `::law`, which proves the
// claim its name makes [D174].
export function isLaw(value) {
  return isValueClass(value, 'taggedInstance') && value.tag.name === LAW_TAG_NAME && isQuote(value.payload);
}

const LAW_TAG_NAME = 'law';

// lawsUnder(env, address) → the laws declared one name under an address,
// each `[lastName, record]` in the order of their declarations [D174].
export function lawsUnder(env, address) {
  return [...namesUnderOf(env, address)].filter(([, record]) => isLaw(bindingValueOf(record)));
}

// The kinds a tag or a set of tags names, or null for any other value.
function kindsNamedBy(value) {
  if (isTagKeyword(value)) return [value.name];
  if (isQSet(value) && value.length > 0 && value.every(isTagKeyword)) return value.map(tag => tag.name);
  return null;
}

// The record of the verb of `verbName` residing on a kind, or null; a
// scope whose frame declares no name with a path reads the root's.
function residenceOf(env, kindName, verbName) {
  const address = `${kindName}/${verbName}`;
  return pathNamesOf(env).includes(address) ? residenceAt(env, address) : onceForRoot(ROOT_RESIDENCES, env, address, residenceAt);
}

const ROOT_RESIDENCES = new WeakMap();

function residenceAt(env, address) {
  const record = nodeOf(env, address);
  return record !== null && residesOn(record, env) ? record : null;
}

// onceForRoot(table, scope, key, read) → what `read(scope, key)` answers,
// read once for the root of the scope, which a change replaces whole.
export function onceForRoot(table, scope, key, read) {
  const root = rootOf(scope);
  let byKey = table.get(root);
  if (byKey === undefined) table.set(root, byKey = new Map());
  let value = byKey.get(key);
  if (value === undefined) byKey.set(key, value = read(scope, key));
  return value;
}

// pathNamesOf(env) → the names with a path the frame of a scope declares;
// a scope never changes once made, so they are read once for it.
export function pathNamesOf(env) {
  let names = PATH_NAMES.get(env);
  if (names === undefined) {
    names = [];
    for (const [name, entry] of env) if (typeof name === 'string' && name.includes('/') && isBinding(entry)) names.push(name);
    PATH_NAMES.set(env, names);
  }
  return names;
}

const PATH_NAMES = new WeakMap();

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

// residenceOnSubject(env, verbName, subject) → the record of the word of
// `verbName` the walk of the subject's tags reaches, the one on `::any`
// last, or null [D34]; with no subject, the one on `::any` alone.
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
// first [D62], [D153]: the reader's declaration, the word residing on a
// kind the walk of the subject reaches, the one word of the name residing
// on a kind, which refuses a subject of another kind [D156], and for a
// name no kind answers the root's declaration [D169], but for a label of
// the root, a kind or a topic, which its tag alone reaches [D191];
// `{ record, underKind }`, or null when no record answers or words of
// several kinds do.
export function bareNameReach(env, name, subject) {
  if (env.has(name) && isBinding(env.get(name))) return { record: env.get(name), underKind: false };
  const residence = residenceOnSubject(env, name, subject);
  if (residence !== null) return { record: residence, underKind: true };
  const residences = residencesOf(env, name);
  const root = rootOf(env);
  if (residences.length === 0 && root.has(name) && !holdsAPage(root.get(name))) return { record: root.get(name), underKind: false };
  return residences.length === 1 ? { record: residences[0][1], underKind: true } : null;
}

// residencesOf(env, verbName) → the words of a name residing on a kind,
// each with its kind, in the order of their declarations, the one on
// `::any` apart, since it answers every value.
export function residencesOf(env, verbName) {
  const residences = [];
  for (const [name, record] of bindingsOf(env)) {
    const [kindName, lastName] = splitAddress(name);
    if (kindName === null || kindName === ANY_KIND_NAME || lastName !== verbName) continue;
    if (residesOn(record, env)) residences.push([kindName, record]);
  }
  return residences;
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

// kindNamesOf(env) → the labels of one segment, a topic among them, the
// root's first, as a tag reads them, then the reader's [D169].
export function kindNamesOf(env) {
  const names = [...rootOf(env).keys(), ...[...env.keys()].filter(name => !rootOf(env).has(name))];
  return names.filter(name => typeof name === 'string' && splitAddress(name)[0] === null && isLabel(env, name));
}

// The addresses where the words of a name live, one for each kind that
// answers it, any value among them, which a refusal of the name hands on
// [D62], [D169].
export function addressesOf(env, verbName) {
  const addresses = residencesOf(env, verbName).map(([kindName]) => makeTagKeyword(`${kindName}/${verbName}`));
  if (residenceOf(env, ANY_KIND_NAME, verbName) !== null) addresses.push(makeTagKeyword(`${ANY_KIND_NAME}/${verbName}`));
  return makeSet(addresses);
}

// The verbs a value of the kinds reaches by name, each with its address,
// from the outside in [D34]: those declared under each kind, then those
// of any value.
export function verbsReaching(env, kindNames) {
  const reached = new Map();
  for (const kindName of [...kindNames, ANY_KIND_NAME]) {
    for (const [name, record] of namesUnderOf(env, kindName)) {
      const verb = bindingValueOf(record);
      if (!residesOn(record, env) || reached.has(name)) continue;
      reached.set(name, { address: makeTagKeyword(`${kindName}/${name}`), verb });
    }
  }
  return reached;
}

// partsOfName(env, address) → the parts of the args of a call of the
// name at the address, by their names, in the order of their places: the
// quotes declared under it, each kind's word declaring its own [D169].
export function partsOfName(env, address) {
  return derivedOf(namesUnderOf(env, address), PARTS, under => [...under]
    .filter(([, record]) => isQuote(bindingValueOf(record)))
    .sort(([, a], [, b]) => orderOfPlace(selectorOf(a).place) - orderOfPlace(selectorOf(b).place)));
}

const PARTS = new WeakMap();

const orderOfPlace = place => (Number.isNaN(place) ? Infinity : place);

// The places the parts read, one past the greatest a part reads strictly
// or softly, or null when a part reads no place, the args whole, a
// place from its end or anything else, and so takes any number of
// values.
export function placesReadBy(parts) {
  let places = 0;
  for (const [, partRecord] of parts) {
    const { place } = selectorOf(partRecord);
    if (!Number.isInteger(place)) return null;
    places = Math.max(places, place + 1);
  }
  return places;
}

// The refusals the runtime raises by rule under a word, each named by the
// address of what refused [D166], [D169]: a subject the walk of whose
// tags reaches no value of the word's label, args of more values than the
// parts read places, a part the call leaves out where the part reads one,
// and an answer that reaches none of the labels its definition names.
export const subjectRefusalAddress = (address, labelName) => `${address}/SubjectNot${capitalOf(labelName)}Error`;
export const argsBeyondPartsAddress = address => `${address}/ArgsBeyondPartsError`;
export const notGivenAddress = partAddress => `${partAddress}/NotGivenError`;
export const answerRefusalAddress = (answerAddress, kinds) => `${answerAddress}/Not${kinds.map(capitalOf).join('Or')}Error`;

const capitalOf = name => { const [, word] = splitAddress(name); return word[0].toUpperCase() + word.slice(1); };

// ruleRefusalsOf(env, address) → the addresses of the refusals the word
// at the address may raise by rule, which its definition pages [D179].
export function ruleRefusalsOf(env, address) {
  const [labelName] = splitAddress(address);
  const parts = partsOfName(env, address);
  const refusals = [subjectRefusalAddress(address, labelName)];
  if (placesReadBy(parts) !== null) refusals.push(argsBeyondPartsAddress(address));
  for (const [, partRecord] of parts) {
    const { onePlace, strict, readsArgs } = selectorOf(partRecord);
    if (!readsArgs && (strict || !onePlace)) refusals.push(notGivenAddress(partRecord.get('name').name));
  }
  const answer = answerOf(env, address);
  if (answer !== null && answer.kinds.length > 1 && !answer.kinds.includes(ANY_KIND_NAME) && !answer.kinds.includes(labelName)) {
    refusals.push(answerRefusalAddress(answer.address, answer.kinds));
  }
  return refusals;
}

// selectorOf(partRecord) → what a part's selector reads, once per part:
// its tree, the place its first step reads, whether the selector is that
// one step, and whether it reads the args whole, `~(/)`.
const SELECTORS = new WeakMap();

export function selectorOf(partRecord) {
  let selector = SELECTORS.get(partRecord);
  if (selector === undefined) {
    const ast = astOfQuote(bindingValueOf(partRecord));
    const place = placeReadBy(ast);
    const onePlace = readsOnePlace(ast, place);
    selector = {
      ast, place, onePlace,
      strict: onePlace && ast.type === 'Projection',
      fallback: onePlace && ast.type === 'Call' && ast.args.length === 2 ? ast.args[1] : null,
      readsArgs: ast.type === 'Projection' && ast.keys.length === 0
    };
    SELECTORS.set(partRecord, selector);
  }
  return selector;
}

// The place a selector's first step reads, by a projection or by `at`, a
// whole number, or none for a selector that reads the args whole, a
// place counted from its end or anything else.
function placeReadBy(ast) {
  const head = ast.type === 'Pipeline' ? ast.steps[0] : ast;
  const place = head.type === 'Projection' ? segmentIndex(head.keys[0])
    : head.type === 'Call' && head.name === 'at' && head.args[0]?.type === 'NumberLit' ? head.args[0].value
    : NaN;
  return Number.isInteger(place) && place >= 0 ? place : NaN;
}

// segmentIndex(key) → the index a segment of a projection names, a whole
// number or one counted from the end, or none for a key that names no
// index, `1e0` among them.
export function segmentIndex(key) {
  return /^-?\d+$/.test(String(key)) ? parseInt(key, 10) : NaN;
}

// Whether a selector is one step that reads one place, `/n` or `at n`
// with a default or none.
function readsOnePlace(ast, place) {
  if (!Number.isInteger(place) || ast.type === 'Pipeline') return false;
  return ast.type === 'Projection' ? ast.keys.length === 1 : ast.args.length <= 2;
}

// The nodes declared one name under a noun, by their last names: the
// root's, read from its index, with the frame's over them, and the map of
// the index itself where the frame declares none under the noun, so what
// a call derives from it is read once for every frame.
function namesUnderOf(env, nounName) {
  const fromRoot = rootIndexOf(rootOf(env)).get(nounName) ?? NO_NAMES;
  let under = fromRoot;
  for (const [name, entry] of env) {
    if (!isBinding(entry) || !isOneNameUnder(name, nounName)) continue;
    if (under === fromRoot) under = new Map(fromRoot);
    under.set(name.slice(nounName.length + 1), entry);
  }
  return under;
}

const NO_NAMES = new Map();

// Whether a name is declared one name under a noun, `vec/count` under
// `vec`, the noun `splitAddress` reads of it.
function isOneNameUnder(name, nounName) {
  return name.length > nounName.length && name.startsWith(nounName)
    && name[nounName.length] === '/' && !name.includes('/', nounName.length + 1);
}

// What a call derives from the names under a noun, read once for each
// map of them and frozen, since every caller holds the same.
function derivedOf(under, derivations, derive) {
  let derived = derivations.get(under);
  if (derived === undefined) {
    derived = Object.freeze(derive(under));
    derivations.set(under, derived);
  }
  return derived;
}

// The names of a root by the noun each is declared under, built once for
// the root, which a change replaces whole.
const ROOT_INDEXES = new WeakMap();

function rootIndexOf(root) {
  let index = ROOT_INDEXES.get(root);
  if (index === undefined) {
    index = new Map();
    for (const [name, record] of root) {
      const [nounName, lastName] = splitAddress(name);
      if (nounName === null) continue;
      if (!index.has(nounName)) index.set(nounName, new Map());
      index.get(nounName).set(lastName, record);
    }
    ROOT_INDEXES.set(root, index);
  }
  return index;
}

// namesUnder(env, tagName) → the nodes declared one name under a noun,
// its verbs, refusals and pages, by address [D62]; its laws are read by
// `laws` [D174].
export function namesUnder(env, tagName) {
  return makeSet([...namesUnderOf(env, tagName)]
    .filter(([, record]) => !isLaw(bindingValueOf(record)))
    .map(([name]) => makeTagKeyword(`${tagName}/${name}`)));
}

// declarationsUnder(env, address) → the records declared under an
// address at any depth, in the order they were written [D168].
export function declarationsUnder(env, address) {
  const prefix = `${address}/`;
  return [...bindingsOf(env)].filter(([name]) => name.startsWith(prefix)).map(([, record]) => record);
}

// namesDeclaredUnder(env, address) → the last names of the nodes declared
// one name under an address, in the order of their declarations.
export function namesDeclaredUnder(env, address) {
  return [...namesUnderOf(env, address).keys()];
}

// The names of every node, which a guessed tag name is held against
// [D118].
export function nodeAddresses(env) {
  return [...bindingsOf(env)].map(([name]) => name);
}

// The names the verbs and the names under a label go by, which a guessed
// name of a step is held against beside the scope's [D118].
export function verbNames(env) {
  const names = new Set();
  for (const [name, record] of bindingsOf(env)) {
    const [nounName, lastName] = splitAddress(name);
    if (nounName !== null && residesOn(record, env)) names.add(lastName);
  }
  return names;
}

// vocabularyWords(env) → the words of the vocabulary, the last names of
// the verbs and of the names a label holds, each declared under a noun,
// which a bare name of the reader may not take [D166].
export function vocabularyWords(env) {
  const words = new Set(rootWordsOf(rootOf(env)));
  for (const [name, entry] of env) {
    if (!isBinding(entry)) continue;
    const [nounName, lastName] = splitAddress(name);
    if (nounName !== null && residesOn(entry, env)) words.add(lastName);
  }
  return words;
}

// The words a root holds, gathered once for the root.
const ROOT_WORDS = new WeakMap();

function rootWordsOf(root) {
  let words = ROOT_WORDS.get(root);
  if (words === undefined) {
    const rootScope = new Map([[ROOT_KEY, root]]);
    words = new Set();
    for (const names of rootIndexOf(root).values()) {
      for (const [lastName, record] of names) if (residesOn(record, rootScope)) words.add(lastName);
    }
    ROOT_WORDS.set(root, words);
  }
  return words;
}


// The names of a scope [D153], each a declaration's, a name with a path,
// `vec/count`, the address of the node it declares under its noun, over
// the root the host's sources declared before the reader's first step:
// a step reads the frame's declaration of a name before the root's, a tag
// name the root's node of it before the reader's, which no reader
// replaces, and a walk of a subject's tags the words residing on each
// kind it passes [D34], [D164].

import {
  isBinding, isBuiltinDescriptor, isDoc, isHostDeclared, isQMap, isQSet, isQuote, isVec, isTag, isTaggedInstance,
  isValueClass, makeSet, makeTag,
  typeKeyword, bindingValueOf, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { rootOf, isRootWordScope } from '../state.mjs';
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

// nodeOf(env, tagName) → the record of the node a tag name addresses, or
// null: a label of the root, a kind or a topic, which no reader declares
// over [D153], else the nearest declaration of the name, as a step reads
// it, the reader's before the root's [D221].
export function nodeOf(env, tagName) {
  const rootEntry = rootOf(env).get(tagName);
  if (isBinding(rootEntry) && holdsAPage(rootEntry)) return rootEntry;
  const entry = env.get(tagName) ?? rootEntry;
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
// address whose value runs is a word, a name under a label but its
// `construct`, which builds the label's values, a name under such a name
// being a part of its args that resides nowhere [D164], [D169], for the
// records of a scope and the declarations of a document alike.
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
// address, each a name whose value is a quote under `::holds`, with the
// kinds it asks for when it is one step `is`, of the value or of each
// element, `{ address, query, kinds, elementKinds }` in the order of
// their declarations [D169].
export function invariantsUnder(env, address) {
  return derivedOf(namesUnderOf(env, address), INVARIANTS, under => {
    const invariants = [];
    for (const [, record] of under) {
      const value = bindingValueOf(record);
      if (!isInvariant(value)) continue;
      const ast = astOfQuote(value.payload);
      invariants.push({ address: record.get('name').name, query: value.payload, kinds: kindsAskedBy(ast), elementKinds: elementKindsAskedBy(ast) });
    }
    return invariants;
  });
}

const INVARIANTS = new WeakMap();

// The kinds an invariant of one step `is ::k …` asks for, or null.
function kindsAskedBy(ast) {
  if (ast.type !== 'Call' || ast.name !== 'is') return null;
  return ast.args.every(arg => arg.type === 'TagLit') ? ast.args.map(arg => arg.tag) : null;
}

// The kinds an invariant `every ~(is ::k …)` asks of each element, or null.
function elementKindsAskedBy(ast) {
  const asksEach = ast.type === 'Call' && ast.name === 'every' && ast.args.length === 1 && ast.args[0].type === 'QuoteLit';
  return asksEach ? kindsAskedBy(ast.args[0].pipeline) : null;
}

// Whether a value is an invariant, a quote under `::holds`, whose name is
// the refusal of a value that breaks it [D168].
export function isInvariant(value) {
  return isValueClass(value, 'taggedInstance') && value.tag.name === INVARIANT_TAG_NAME && isQuote(value.payload);
}

const INVARIANT_TAG_NAME = 'holds';

// Whether a value is a law, a quote under `::law`, which proves the
// claim its name makes [D123].
export function isLaw(value) {
  return isValueClass(value, 'taggedInstance') && value.tag.name === LAW_TAG_NAME && isQuote(value.payload);
}

const LAW_TAG_NAME = 'law';

// lawsUnder(env, address) → the laws declared one name under an address,
// each `[lastName, record]` in the order of their declarations [D123].
export function lawsUnder(env, address) {
  return [...namesUnderOf(env, address)].filter(([, record]) => isLaw(bindingValueOf(record)));
}

// The kinds a tag or a set of tags names, or null for any other value.
function kindsNamedBy(value) {
  if (isTag(value)) return [value.name];
  if (isQSet(value) && value.length > 0 && value.every(isTag)) return value.map(tag => tag.name);
  return null;
}

// Whether a scope reads what a reader declared under a noun: every scope
// does but a word's of the root, which reads a noun of the root in the
// root alone, a reader's extension of it staying in the reader's queries,
// and a noun the reader declared, whose values carry it, as the reader
// wrote it [D200].
export function readsTheReaderUnder(env, nounName) {
  return !isRootWordScope(env) || !rootOf(env).has(nounName);
}

// The record of the verb of `verbName` residing on a kind, or null; a
// scope whose frame does not declare the address, or reads the root alone
// under the kind, reads the root's.
function residenceOf(env, kindName, verbName) {
  const address = `${kindName}/${verbName}`;
  return readsTheReaderUnder(env, kindName) && pathNamesOf(env).includes(address) ? residenceAt(env, address) : onceForRoot(ROOT_RESIDENCES, env, address, rootResidenceAt);
}

const rootResidenceAt = (env, address) => residenceAt(rootScopeOf(env), address);

// rootScopeOf(env) → the scope of the root alone beneath a scope.
const ROOT_SCOPES = new WeakMap();

export function rootScopeOf(env) {
  const root = rootOf(env);
  let scope = ROOT_SCOPES.get(root);
  if (scope === undefined) ROOT_SCOPES.set(root, scope = new Map([[ROOT_KEY, root]]));
  return scope;
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
// of the value, the kind of every tagged value after a tag [D34], the
// payload beneath a tag over a value, the kind of a vector or a map
// beneath a tag of its own, and, after the kind of tag names, the noun a
// tag name names [D88].
function* kindsOfWalk(subject) {
  let value = subject;
  for (;;) {
    yield typeKeyword(value).name;
    if (isTag(value)) {
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
// first [D34], [D153]: the reader's declaration, the word residing on a
// kind the walk of the subject reaches, the one word of the name residing
// on a kind, which refuses a subject of another kind [D34], and for a
// name no kind answers the root's declaration [D169], but for a label of
// the root, a kind or a topic, which its tag alone reaches [D191];
// `{ record, underKind }`, or null when no record answers or words of
// several kinds do.
export function bareNameReach(env, name, subject) {
  if (env.has(name) && isBinding(env.get(name))) return { record: env.get(name), underKind: false };
  const residence = residenceOnSubject(env, name, subject);
  if (residence !== null) return { record: residence, underKind: true };
  const residences = residencesOf(isRootWordScope(env) ? rootScopeOf(env) : env, name);
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
// [D34], [D169].
export function addressesOf(env, verbName) {
  const addresses = residencesOf(env, verbName).map(([kindName]) => makeTag(`${kindName}/${verbName}`));
  if (residenceOf(env, ANY_KIND_NAME, verbName) !== null) addresses.push(makeTag(`${ANY_KIND_NAME}/${verbName}`));
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
      reached.set(name, { address: makeTag(`${kindName}/${name}`), verb });
    }
  }
  return reached;
}

// partsOfName(env, address) → the parts of the args of a call of the
// name at the address, by their names, in the order of their places: the
// quotes declared under it, each kind's word declaring its own [D169].
export function partsOfName(env, address) {
  return [...namesUnderOf(env, address)]
    .filter(([, record]) => isQuote(bindingValueOf(record)))
    .sort(([, a], [, b]) => orderOfPlace(selectorOf(a).place) - orderOfPlace(selectorOf(b).place));
}

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
// its verbs, refusals and pages, by address [D34]; its laws are read by
// `laws` [D123].
export function namesUnder(env, tagName) {
  return makeSet([...namesUnderOf(env, tagName)]
    .filter(([, record]) => !isLaw(bindingValueOf(record)))
    .map(([name]) => makeTag(`${tagName}/${name}`)));
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


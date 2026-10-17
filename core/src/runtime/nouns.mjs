// The names of a scope, each a declaration's, a name with a path,
// `vec/count`, the address of the node it declares under its noun, over the
// root the host's sources declared before the reader's first step: a step
// reads the scope's declaration of a name before the root's, a tag name the
// root's node of it before the reader's, which no reader replaces, and a walk
// of a subject's tags the verbs residing on each kind it passes [D352].

import {
  isBinding, isBuiltinDescriptor, isDoc, isHostDeclared, isMap, isQuote, isVec, isTag, isTagged,
  isValueClass, isPath, isFn, isKind, recipeOf, makeSet, makeTag, makeTagged,
  typeOf, bindingValueOf, keyword, TAG_HEADER_SYMBOL, KINDS_OF_OWN_VECTORS
} from '../types.mjs';
import { rootOf, isRootVerbScope } from '../state.mjs';
import { splitAddress } from '../address.mjs';
import { ROOT_KEY, WITHHELD_KEY } from '../env-keys.mjs';
import { declareRefusal } from '../errors.mjs';
import { astOfQuote } from '../quote.mjs';
import { segmentIndex } from '../path-read.mjs';
import { ANSWER_NAME, functionOfRecipe, kindOf, signatureOf } from './signature.mjs';

// The kind every value answers, and the kind of every value under a tag.
export const ANY_KIND_NAME = 'any';
export const TAGGED_KIND_NAME = 'tagged';

// The bindings of a scope by name: the root's a name of the scope does
// not stand over, then the scope's.
function* bindingsOf(env) {
  for (const [name, entry] of rootOf(env)) if (!env.has(name)) yield [name, entry];
  for (const [name, entry] of env) if (isBinding(entry)) yield [name, entry];
}

// nodeOf(env, tagName) → the record of the node a tag name addresses, or null:
// a label of the root, a kind or a topic, which no reader declares over
// [QSDSP#residence], else the nearest declaration of the name, as a step reads
// it, the reader's before the root's [QSLIT#keyword].
export function nodeOf(env, tagName) {
  const rootEntry = rootOf(env).get(tagName);
  if (isBinding(rootEntry) && declaresALabel(rootEntry)) return rootEntry;
  const entry = env.get(tagName) ?? rootEntry;
  return isBinding(entry) ? entry : null;
}

// A value a reader named is withheld from the lane of held code, and a
// read of its name there is refused under it, so no verb, no value of the
// root and no tag of identity answers for it [D352]: a step reads the
// scope's declaration of a name before the root's and refuses it, while a
// tag, the noun of a declaration among them, reads a label of the root
// before any name of the reader, and the label stays.
export const CallValueWithheldError = declareRefusal('call/ValueWithheldError');

export function refuseWithheld(env, name, readByTag = false) {
  if (env.has(name) || !env.get(WITHHELD_KEY)?.has(name)) return;
  if (readByTag && declaresALabel(rootOf(env).get(name))) return;
  throw new CallValueWithheldError({ name: keyword(name) });
}

// Whether a record holds a page or a kind, either of which makes its name
// a label [QSBLD#label].
export function declaresALabel(record) {
  const value = bindingValueOf(record);
  return isDoc(value) || isKind(value);
}

// Whether a node is a label, a name declared by its page.
export function isLabel(env, name) {
  return declaresALabel(nodeOf(env, name));
}

// Whether a name stands under a label, where a quote or a host's
// primitive runs on the label's values [QSNAM#word].
export function isUnderLabel(env, name) {
  const [labelName] = splitAddress(name);
  return labelName !== null && isLabel(env, labelName);
}

// declaresVerb(address, runs, isLabelName) → whether a declaration at the
// address whose value runs is a verb, a name under a label but its
// `construct`, which builds the label's values, for the records of a scope
// and the declarations of a document alike.
export function declaresVerb(address, runs, isLabelName) {
  const [labelName, lastName] = splitAddress(address);
  return runs && labelName !== null && lastName !== CONSTRUCT_NAME && isLabelName(labelName);
}

export const CONSTRUCT_NAME = 'construct';

// Whether a record holds a verb, its value a quote or the descriptor of a
// host's primitive, which run on the label's values.
function residesOn(record, env) {
  return declaresVerb(record.get('name').name, isMemberValue(bindingValueOf(record)), labelName => isLabel(env, labelName));
}

// isVerb(env, address) → whether the name at the address is a verb; a
// verb is the label of the args of a call of it [D352].
export function isVerb(env, address) {
  const record = nodeOf(env, address);
  return record !== null && residesOn(record, env);
}

// A value a name under a label holds when it runs on the label's values:
// a recipe, code or a host's primitive, or a function whose recipe is one
// [QSBLD#fn].
export function isMemberValue(value) {
  return isRecipe(value) || (isFn(value) && isRecipe(recipeOf(value)));
}

export function isRecipe(value) {
  return isQuote(value) || (isBuiltinDescriptor(value) && isHostDeclared(value));
}

// answerOf(env, address) → the answer of the verb at the address as the
// node `answer` its function lays under it holds it, the kinds `returns`
// names, `{ address, kinds }`, or null for a verb that answers any value
// [D352].
export function answerOf(env, address) {
  const record = nodeOf(env, `${address}/${ANSWER_NAME}`);
  return record === null ? null : { address: record.get('name').name, kinds: kindsNamedBy(bindingValueOf(record)) };
}

// Whether a value is an invariant, a quote under `::holds`, whose name is
// the refusal of a value that breaks it [QSSLF#catalog].
export function isInvariant(value) {
  return isValueClass(value, 'underTag') && value.tag.name === INVARIANT_TAG_NAME && isQuote(value.payload);
}

export const INVARIANT_TAG = makeTag('holds');
const INVARIANT_TAG_NAME = INVARIANT_TAG.name;

// Whether a value is a law, a quote under `::law`, which proves the
// claim its name makes [QSSLF#laws].
export function isLaw(value) {
  return isValueClass(value, 'underTag') && value.tag.name === LAW_TAG_NAME && isQuote(value.payload);
}

export const LAW_TAG = makeTag('law');
const LAW_TAG_NAME = LAW_TAG.name;

// lawsUnder(env, address) → the laws declared one name under an address,
// each `[lastName, record]` in the order of their declarations [QSSLF#laws].
export function lawsUnder(env, address) {
  return [...namesUnderOf(env, address)].filter(([, record]) => isLaw(bindingValueOf(record)));
}

// The kinds the answer of a verb names, the tag or the set of tags its
// `returns` writes [D352].
const kindsNamedBy = value => (isTag(value) ? [value.name] : value.map(tag => tag.name));

// Whether a scope reads what a reader declared under a noun: every scope
// does but a verb's of the root, which reads a noun of the root in the
// root alone, a reader's extension of it staying in the reader's queries,
// and a noun the reader declared, whose values carry it, as the reader
// wrote it [D352].
export function readsTheReaderUnder(env, nounName) {
  return !isRootVerbScope(env) || !rootOf(env).has(nounName);
}

// The record of the verb of `verbName` residing on a kind, or null; a
// scope that does not declare the address, or reads the root alone under
// the kind, reads the root's.
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

// pathNamesOf(env) → the names with a path a scope declares;
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

// The kinds a verb is looked for on, from the outside in: the kind of the
// value, the kind of every tagged value after a tag [QSDSP#walk], the payload
// beneath a tag over a value, the kind of a vector or a map
// beneath a tag of its own, and, after the kind of tag names, the noun a
// tag name names [QSDSP#tagname].
export function* kindsOfWalk(subject) {
  let value = subject;
  for (;;) {
    yield typeOf(value).name;
    if (isTag(value)) {
      yield value.name;
      return;
    }
    if (isTagged(value)) yield TAGGED_KIND_NAME;
    if (isValueClass(value, 'underTag')) {
      value = value.payload;
      continue;
    }
    if (value?.[TAG_HEADER_SYMBOL] !== undefined && isVec(value)) yield 'vec';
    else if (value?.[TAG_HEADER_SYMBOL] !== undefined && isMap(value)) yield 'map';
    return;
  }
}

// residenceOnSubject(env, verbName, subject) → the record of the verb of
// `verbName` the walk of the subject's tags reaches, the one on `::any`
// last, or null [D352]; with no subject, the one on `::any` alone.
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
// first [D352]: the reader's declaration, the verb residing on a kind the
// walk of the subject reaches, the one verb of the name residing on a kind,
// which refuses a subject of another kind, and for a name no kind answers
// the root's declaration, but for a label of the root, a kind or a topic,
// which its tag alone reaches; `{ record, underKind }`, or null when no
// record answers or verbs of several kinds do.
export function bareNameReach(env, name, subject) {
  if (env.has(name) && isBinding(env.get(name))) return { record: env.get(name), underKind: false };
  const residence = residenceOnSubject(env, name, subject);
  if (residence !== null) return { record: residence, underKind: true };
  const residences = residencesOf(isRootVerbScope(env) ? rootScopeOf(env) : env, name);
  const root = rootOf(env);
  if (residences.length === 0 && root.has(name) && !declaresALabel(root.get(name))) return { record: root.get(name), underKind: false };
  return residences.length === 1 ? { record: residences[0][1], underKind: true } : null;
}

// residencesOf(env, verbName) → the verbs of a name residing on a kind,
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
// [QSDSP#residence].
export function scopeNamesOf(env) {
  const scopeNames = new Map();
  for (const [name, record] of bindingsOf(env)) {
    if (splitAddress(name)[0] === null) scopeNames.set(name, record);
  }
  return scopeNames;
}

// readerNamesOf(env) → what the reader declared, by name, the root apart
// [QSNAM#binding].
export function readerNamesOf(env) {
  const readerNames = new Map();
  for (const [name, entry] of env) if (isBinding(entry)) readerNames.set(name, entry);
  return readerNames;
}

// kindNamesOf(env) → the labels of one segment, a topic among them, the
// root's first, as a tag reads them, then the reader's [QSSLF#catalog].
export function kindNamesOf(env) {
  const names = [...rootOf(env).keys(), ...[...env.keys()].filter(name => !rootOf(env).has(name))];
  return names.filter(name => typeof name === 'string' && splitAddress(name)[0] === null && isLabel(env, name));
}

// The addresses where the verbs of a name live, one for each kind that
// answers it, any value among them, which a refusal of the name hands on
// [D352].
export function addressesOf(env, verbName) {
  const addresses = residencesOf(env, verbName).map(([kindName]) => makeTag(`${kindName}/${verbName}`));
  if (residenceOf(env, ANY_KIND_NAME, verbName) !== null) addresses.push(makeTag(`${ANY_KIND_NAME}/${verbName}`));
  return makeSet(addresses);
}

// The verbs a value of the kinds reaches by name, each with its address,
// from the outside in [QSDSP#walk]: those declared under each kind and the
// kinds its walk passes beneath it, then those of any value.
export function verbsReaching(env, kindNames) {
  const reached = new Map();
  for (const kindName of new Set([...kindNames.flatMap(kindsWalkedFrom), ANY_KIND_NAME])) {
    for (const [name, record] of namesUnderOf(env, kindName)) {
      const verb = bindingValueOf(record);
      if (!residesOn(record, env) || reached.has(name)) continue;
      reached.set(name, { address: makeTag(`${kindName}/${name}`), verb });
    }
  }
  return reached;
}

// The kinds the walk of a value of a kind passes, the kind first: for a
// kind of the core whose values are vectors under a tag of their own those
// its empty value passes, a set `::tagged` and `::vec` after `::set`, and
// for any other the kind alone [QSDSP#walk].
const kindsWalkedFrom = kindName => (KINDS_OF_OWN_VECTORS.includes(kindName)
  ? [...kindsOfWalk(makeTagged(makeTag(kindName), []))]
  : [kindName]);

// placesOfReadings(readings) → the places the inputs of a function read,
// one past the greatest index an input reads strictly or softly, or null
// when one reads no index, the args whole, a place counted from its end,
// code of several steps or anything else, and so takes any number of
// values [D352].
export function placesOfReadings(readings) {
  let places = 0;
  for (const { index, ast } of readings) {
    if (!Number.isInteger(index) || ast.type === 'Pipeline') return null;
    places = Math.max(places, index + 1);
  }
  return places;
}

// The refusals the runtime raises by rule under a verb, each named by the
// address of what refused [D352]: a subject the walk of
// whose tags reaches no value of the verb's label, args of more values than
// its inputs read places, an input the call leaves out where its place reads
// one, and an answer that reaches none of the kinds `returns` names; and under
// a kind, a payload of none of its kinds, or an element of none, a refusal of
// kinds named by the role of its holder alone.
export const subjectRefusalAddress = (address, kinds) => `${address}/SubjectNot${kindsWord(kinds)}Error`;
// The subject of a function `apply` runs, which no label serves, is refused
// by its role, the kinds `on` names its `:expected` [QSBLD#fn].
export const subjectKindsRefusalAddress = address => `${address}/SubjectKindNotTakenError`;
export const argsBeyondInputsAddress = address => `${address}/ArgsBeyondInputsError`;
export const notGivenAddress = holderAddress => `${holderAddress}/NotGivenError`;
export const kindsRefusalAddress = address => `${address}/KindNotTakenError`;
export const elementsRefusalAddress = address => `${address}/ElementKindNotTakenError`;
export const payloadRefusalName = each => `${each ? 'Element' : 'Payload'}KindNotTakenError`;

const kindsWord = kinds => kinds.map(capitalOf).join('Or');
const capitalOf = name => { const [, word] = splitAddress(name); return word[0].toUpperCase() + word.slice(1); };

// ruleRefusalsOf(env, address) → the addresses of the refusals a verb or a
// kind at the address may raise by rule, which its chain pages: a verb's
// read from its function, a recipe's from the function of no commands it
// is, and a kind's from its commands [D352].
export function ruleRefusalsOf(env, address) {
  const [labelName] = splitAddress(address);
  const value = bindingValueOf(nodeOf(env, address));
  if (isKind(value)) return kindRuleRefusalsOf(kindOf(value), address);
  return functionRuleRefusalsOf(signatureOf(isFn(value) ? value : functionOfRecipe(value)), address, labelName);
}

// The refusals the call of a verb that is a function raises by rule, read
// from its signature [D352]: a subject of none of the kinds it serves,
// named by its label, args beyond the places its inputs read, an input the
// call leaves out where its place reads one and not the args whole, an
// input of none of its kinds, or that is no vector where it names the
// kinds of each element, and an element of none of them, and an answer of
// none of several kinds.
export function functionRuleRefusalsOf(signature, address, labelName) {
  const refusals = [subjectRefusalAddress(address, [labelName])];
  if (signature.places !== null) refusals.push(argsBeyondInputsAddress(address));
  for (const { name, kinds, each, reading } of signature.inputs) {
    const inputAddress = `${address}/${name.name}`;
    if (!reading.readsArgs && (reading.strict || !reading.onePlace)) refusals.push(notGivenAddress(inputAddress));
    if (each && !reading.readsArgs) refusals.push(kindsRefusalAddress(inputAddress));
    if (kinds !== null) refusals.push(each ? elementsRefusalAddress(inputAddress) : kindsRefusalAddress(inputAddress));
  }
  const kinds = signature.answer?.kinds ?? null;
  if (kinds !== null && kinds.length > 1 && !kinds.includes(labelName)) refusals.push(kindsRefusalAddress(`${address}/${ANSWER_NAME}`));
  return refusals;
}

// The refusals a kind raises by rule as it lays its tag over a payload, read
// from its commands [QSBLD#kind]: a payload of none of its kinds, or that is
// no vector where they are the kinds of each element, and an element of none;
// a field the payload leaves out, and a field of none of its kinds, or no
// vector, and an element of none.
export function kindRuleRefusalsOf({ payload, fields }, address) {
  const refusals = [];
  if (payload?.each) refusals.push(`${address}/${payloadRefusalName(false)}`);
  if (payload?.kinds) refusals.push(`${address}/${payloadRefusalName(payload.each)}`);
  for (const { name, kinds, each } of fields) {
    const fieldAddress = `${address}/${name.name}`;
    refusals.push(notGivenAddress(fieldAddress));
    if (each) refusals.push(kindsRefusalAddress(fieldAddress));
    if (kinds !== null) refusals.push(each ? elementsRefusalAddress(fieldAddress) : kindsRefusalAddress(fieldAddress));
  }
  return refusals;
}

// readingOfPlace(place) → how the place of an input of a function reads the
// args, once per place [D352]: its tree, a path read as it is written, the
// index of the arg its first step reads, whether the place is that one step,
// and whether it reads the args whole, `~(it)`.
const READINGS = new WeakMap();

export function readingOfPlace(value) {
  let reading = READINGS.get(value);
  if (reading === undefined) {
    const ast = isPath(value) ? { type: 'Path', keys: value.segments } : astOfQuote(value);
    const index = indexReadBy(ast);
    const onePlace = readsOnePlace(ast, index);
    reading = {
      ast, index, onePlace,
      strict: onePlace && ast.type === 'Path',
      fallback: onePlace && ast.type === 'Call' && ast.args.length === 2 ? ast.args[1] : null,
      readsArgs: ast.type === 'Call' && ast.name === 'it' && ast.args.length === 0
    };
    READINGS.set(value, reading);
  }
  return reading;
}

// The index of the arg the first step of a place reads, by a path or by
// `query`, a whole number, or none for a place that reads the args whole,
// one counted from its end or anything else.
function indexReadBy(ast) {
  const head = ast.type === 'Pipeline' ? ast.steps[0] : ast;
  const index = head.type === 'Path' ? segmentIndex(head.keys[0])
    : head.type === 'Call' && head.name === 'query' && head.args[0]?.type === 'Path' && head.args[0].keys.length === 1 ? segmentIndex(head.args[0].keys[0])
    : NaN;
  return Number.isInteger(index) && index >= 0 ? index : NaN;
}

// Whether a place is one step that reads one arg, `/n` or `query /n` with a
// default or none.
function readsOnePlace(ast, index) {
  if (!Number.isInteger(index) || ast.type === 'Pipeline') return false;
  return ast.type === 'Path' ? ast.keys.length === 1 : ast.args.length <= 2;
}

// The nodes declared one name under a noun, by their last names: the
// root's, read from its index, with the scope's over them, and the map of
// the index itself where the scope declares none under the noun, so what
// a call derives from it is read once for every scope.
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
// its verbs, refusals and pages, by address [QSDSP#walk]; its laws are read by
// `laws` [QSSLF#laws].
export function namesUnder(env, tagName) {
  return makeSet([...namesUnderOf(env, tagName)]
    .filter(([, record]) => !isLaw(bindingValueOf(record)))
    .map(([name]) => makeTag(`${tagName}/${name}`)));
}

// declarationsUnder(env, address) → the records declared under an
// address at any depth, in the order they were written [QSSLF#catalog].
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
// [QSSLF#near].
export function nodeAddresses(env) {
  return [...bindingsOf(env)].map(([name]) => name);
}

// The names the verbs and the names under a label go by, which a guessed
// name of a step is held against beside the scope's [QSSLF#near].
export function verbNames(env) {
  const names = new Set();
  for (const [name, record] of bindingsOf(env)) {
    const [nounName, lastName] = splitAddress(name);
    if (nounName !== null && residesOn(record, env)) names.add(lastName);
  }
  return names;
}


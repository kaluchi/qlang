// The words a sequence answers across its kinds, each taking the values alone,
// the value the walk served and the inputs of the call, an input that takes
// code arriving closed at the call, code run on the element [QSBLD#fn],
// [QSDSP#walk]: a verb of vectors reads the elements in order, a set reaching it
// through the walk in its one order [QSORD#order], [QSDSP#residence], a map's reads
// its values and keeps its keys [QSCOL#map], a string's reads its characters
// [QSTXT#string], and a refusal names the verb that refused [QSERR#site].

import { beneathTags, isNumber, isKeyword, isPath, isSet, isErrorValue, isVec, NULL, makePath, typeOf, TagsInCommon, pairRefused } from '../types.mjs';
import { compareValues, makeSet } from '../ordering.mjs';
import { declareRefusal, refusingAPart } from '../errors.mjs';
import { registerPrimitive, registerStateReader, runs, folds, combines } from '../primitives.mjs';
import { underSharedTags } from '../eval.mjs';
import { atPlace } from '../eval-trace.mjs';
import { keywordFiledFor, KINDS_A_KEY_FILES_UNDER } from './convert.mjs';
import { writtenAsText } from './string.mjs';
import { pathReads } from './path.mjs';

// The elements, each beside the segment of the path that places it, its index
// from zero in a sequence and its key in a map [QSERR#trace].
const entriesOf = elements => [...elements.entries()];

const failedAt = (code, error, segment) => atPlace(code, error, makePath([String(segment)]));

// ── size and ends ──────────────────────────────────────────────

registerPrimitive('string/count', text => Array.from(text).length);
registerPrimitive('vec/count', sequence => sequence.length);
registerPrimitive('map/count', map => map.size);

registerPrimitive('vec/empty', sequence => sequence.length === 0);
registerPrimitive('map/empty', map => map.size === 0);

const firstOf = items => (items.length === 0 ? NULL : items[0]);
const lastOf = items => (items.length === 0 ? NULL : items[items.length - 1]);
registerPrimitive('vec/first', firstOf);
registerPrimitive('map/first', map => firstOf([...map.values()]));
registerPrimitive('vec/last', lastOf);
registerPrimitive('map/last', map => lastOf([...map.values()]));

// ── side by side ───────────────────────────────────────────────
// The elements at each index of the vectors a vector or a set holds, as long
// as the shortest, an element that is no vector refused at its index
// [QSCOL#sequence], [QSORD#set].
const VecZipElementNotVecError = declareRefusal('vec/zip/ElementNotVecError');
const SetZipElementNotVecError = declareRefusal('set/zip/ElementNotVecError');
function columnsOf(vectors, ElementNotVecError) {
  const columns = vectors.map(beneathTags);
  columns.forEach((column, index) => {
    if (!Array.isArray(column)) throw refusingAPart(new ElementNotVecError({ actualValue: vectors[index] }), index);
  });
  const length = columns.length === 0 ? 0 : Math.min(...columns.map(column => column.length));
  return Array.from({ length }, (_, index) => columns.map(column => column[index]));
}
registerPrimitive('vec/zip', vectors => columnsOf(vectors, VecZipElementNotVecError));
registerPrimitive('set/zip', vectors => columnsOf(vectors, SetZipElementNotVecError));

// ── sum and mean ───────────────────────────────────────────────

// The number an element holds beneath the tags over it, as `add` reads
// its subject [QSNUM#arithmetic], or undefined.
function numberBeneath(element) {
  const beneath = beneathTags(element);
  return isNumber(beneath) ? beneath : undefined;
}

// The tags of the numbers the elements hold, each handed to `take`, an element
// refused where it stands for its kind first, then for its tags [QSCOL#sequence].
function eachNumber(elements, ElementNotNumberError, take) {
  const tally = new TagsInCommon();
  for (const [count, [at, element]] of elements.entries()) {
    const number = numberBeneath(element);
    if (number === undefined) throw refusingAPart(new ElementNotNumberError({ actualValue: element }), at);
    const met = tally.meet(element);
    if (met !== null) throw refusingAPart(pairRefused(met, element), at);
    take(number, count);
  }
  return tally.tags;
}

function totalOf(elements, ElementNotNumberError, state) {
  let total = 0;
  const tags = eachNumber(elements, ElementNotNumberError, number => { total += number; });
  return underSharedTags(total, tags, state);
}

const VecSumElementNotNumberError = declareRefusal('vec/sum/ElementNotNumberError');
const MapSumElementNotNumberError = declareRefusal('map/sum/ElementNotNumberError');
registerStateReader('vec/sum', (vector, state) => totalOf(entriesOf(vector), VecSumElementNotNumberError, state));
registerStateReader('map/sum', (map, state) => totalOf(entriesOf(map), MapSumElementNotNumberError, state));

// The mean of the numbers under the tags they share, a running mean whose
// every step stays among the finite doubles; an empty container has none, and
// answers null as `min` and `max` do [QSCOL#sequence].
function meanOf(elements, ElementNotNumberError, state) {
  if (elements.length === 0) return NULL;
  let mean = 0;
  const tags = eachNumber(elements, ElementNotNumberError, (number, count) => {
    const gap = number - mean;
    mean += Number.isFinite(gap) ? gap / (count + 1) : number / (count + 1) - mean / (count + 1);
  });
  return underSharedTags(mean, tags, state);
}

const VecAvgElementNotNumberError = declareRefusal('vec/avg/ElementNotNumberError');
const MapAvgElementNotNumberError = declareRefusal('map/avg/ElementNotNumberError');
registerStateReader('vec/avg', (vector, state) => meanOf(entriesOf(vector), VecAvgElementNotNumberError, state));
registerStateReader('map/avg', (map, state) => meanOf(entriesOf(map), MapAvgElementNotNumberError, state));

// ── ranking ────────────────────────────────────────────────────

// The error a key answered for an element, the key itself or a part of
// the vector it answered, or null [QSERR#flow], [QSORD#sort].
function errorOfKey(rankKey) {
  if (isErrorValue(rankKey)) return rankKey;
  return isVec(rankKey) ? rankKey.find(isErrorValue) ?? null : null;
}

// Each entry, its index or its key beside its element, beside the value it
// ranks by, its own without a key, an error among the elements ranked as the
// one order ranks it, or the error a key answered at the entry's place.
async function keyedEntries(entries, key) {
  const ranked = [];
  for (const entry of entries) {
    if (key === NULL) {
      ranked.push({ entry, sortKey: entry[1] });
      continue;
    }
    const sortKey = await key(entry[1]);
    const failed = errorOfKey(sortKey);
    if (failed !== null) return failedAt(key, failed, entry[0]);
    ranked.push({ entry, sortKey });
  }
  return ranked;
}

// The least or the greatest element in the one order, or by the value
// the key answers for each, `pick` naming which side wins a comparison,
// the first of equal ones staying, two of two kinds refused as a comparison
// refuses them [QSORD#sort].
async function extremeOf(entries, key, pick) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  if (ranked.length === 0) return NULL;
  let best = ranked[0];
  for (const candidate of ranked.slice(1)) {
    if (typeOf(ranked[0].sortKey).name !== typeOf(candidate.sortKey).name) throw refusingAPart(pairRefused(ranked[0].sortKey, candidate.sortKey), candidate.entry[0]);
    if (pick(compareValues(candidate.sortKey, best.sortKey))) best = candidate;
  }
  return best.entry[1];
}

const least = order => order < 0;
const greatest = order => order > 0;
registerPrimitive('vec/min', runs(['key'], (sequence, key) => extremeOf([...sequence.entries()], key, least)));
registerPrimitive('map/min', runs(['key'], (map, key) => extremeOf([...map], key, least)));
registerPrimitive('vec/max', runs(['key'], (sequence, key) => extremeOf([...sequence.entries()], key, greatest)));
registerPrimitive('map/max', runs(['key'], (map, key) => extremeOf([...map], key, greatest)));

// `sort` orders the elements in the one order, or by the value the key answers
// for each, keeping equal ones in the subject's order; a map orders its
// entries by their values and keeps the keys. A vector the key answers ranks
// element by element, and `desc` reverses one index of it. A key that answers an
// error answers the call, as the key of `groupBy` does, and so does one whose
// vector holds an error [QSERR#flow], [QSORD#sort].
async function sortedEntries(entries, key) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  ranked.sort((left, right) => compareValues(left.sortKey, right.sortKey));
  return ranked.map(({ entry }) => entry);
}

registerPrimitive(['vec/sort', 'set/sort'], runs(['key'], async (sequence, key) => {
  const sorted = await sortedEntries([...sequence.entries()], key);
  return isErrorValue(sorted) ? sorted : sorted.map(([, element]) => element);
}));
registerPrimitive('map/sort', runs(['key'], async (map, key) => {
  const sorted = await sortedEntries([...map], key);
  return isErrorValue(sorted) ? sorted : new Map(sorted);
}));

// ── code on each element ───────────────────────────────────────

// `map` runs its code on each element in order and answers what each
// answered, the first error the code answers answering for the call at the
// place of its element, the elements after it left unrun [QSCOL#image],
// [QSERR#trace]; a map keeps its keys.
async function answersOf(elements, code) {
  const answers = [];
  for (const [at, element] of elements) {
    const answer = await code(element);
    if (isErrorValue(answer)) return failedAt(code, answer, at);
    answers.push(answer);
  }
  return answers;
}

registerPrimitive('vec/map', runs(['code'], (sequence, code) => answersOf(entriesOf(sequence), code)));
registerPrimitive('map/map', runs(['code'], async (map, code) => {
  const answers = await answersOf(entriesOf(map), code);
  return isErrorValue(answers) ? answers : new Map([...map.keys()].map((key, index) => [key, answers[index]]));
}));

// ── predicates ─────────────────────────────────────────────────

// A predicate answers a boolean for each element or fails [QSCND#boolean]: the
// error it answered is handed on at the place of the element [QSERR#trace], and
// another answer is refused where the element stands.
async function verdictOf(predicate, at, element, ConditionNotBooleanError) {
  const verdict = await predicate(element);
  if (isErrorValue(verdict)) return failedAt(predicate, verdict, at);
  const beneath = beneathTags(verdict);
  if (typeof beneath === 'boolean') return beneath;
  throw refusingAPart(new ConditionNotBooleanError({ actualValue: verdict }), at);
}

// `filter` keeps the elements whose predicate answers true, and a map the
// entries whose values do.
async function keptElements(sequence, predicate, ConditionNotBooleanError) {
  const kept = [];
  for (const [at, element] of entriesOf(sequence)) {
    const verdict = await verdictOf(predicate, at, element, ConditionNotBooleanError);
    if (isErrorValue(verdict)) return verdict;
    if (verdict) kept.push(element);
  }
  return kept;
}

async function keptEntries(map, predicate, ConditionNotBooleanError) {
  const kept = new Map();
  for (const [key, value] of map) {
    const verdict = await verdictOf(predicate, key, value, ConditionNotBooleanError);
    if (isErrorValue(verdict)) return verdict;
    if (verdict) kept.set(key, value);
  }
  return kept;
}

const VecFilterConditionNotBooleanError = declareRefusal('vec/filter/ConditionNotBooleanError');
const MapFilterConditionNotBooleanError = declareRefusal('map/filter/ConditionNotBooleanError');
registerPrimitive('vec/filter', runs(['predicate'], (vector, predicate) => keptElements(vector, predicate, VecFilterConditionNotBooleanError)));
registerPrimitive('map/filter', runs(['predicate'], (map, predicate) => keptEntries(map, predicate, MapFilterConditionNotBooleanError)));

// Whether the predicate of every element answers true, the first false
// answering for the call, and whether the predicate of any does, the
// first true answering.
async function firstVerdict(elements, predicate, decisive, ConditionNotBooleanError) {
  for (const [at, element] of elements) {
    const verdict = await verdictOf(predicate, at, element, ConditionNotBooleanError);
    if (isErrorValue(verdict) || verdict === decisive) return verdict;
  }
  return !decisive;
}

const VecEveryConditionNotBooleanError = declareRefusal('vec/every/ConditionNotBooleanError');
const MapEveryConditionNotBooleanError = declareRefusal('map/every/ConditionNotBooleanError');
registerPrimitive('vec/every', runs(['predicate'], (vector, predicate) => firstVerdict(entriesOf(vector), predicate, false, VecEveryConditionNotBooleanError)));
registerPrimitive('map/every', runs(['predicate'], (map, predicate) => firstVerdict(entriesOf(map), predicate, false, MapEveryConditionNotBooleanError)));

const VecAnyConditionNotBooleanError = declareRefusal('vec/any/ConditionNotBooleanError');
const MapAnyConditionNotBooleanError = declareRefusal('map/any/ConditionNotBooleanError');
registerPrimitive('vec/any', runs(['predicate'], (vector, predicate) => firstVerdict(entriesOf(vector), predicate, true, VecAnyConditionNotBooleanError)));
registerPrimitive('map/any', runs(['predicate'], (map, predicate) => firstVerdict(entriesOf(map), predicate, true, MapAnyConditionNotBooleanError)));

// ── partitions ─────────────────────────────────────────────────

// The keyword the key of `groupBy` or `indexBy` answers for an element, the
// one `toKeyword` names it by, a key of another kind refused at its element
// with the kinds a key files under as `:expected`, or the error it answered;
// without a key the element is its own, and two values of the key that file
// under one keyword meet, `1` and `"1"` under `:"1"`, the second refused
// [QSCOL#group].
async function keywordOf(key, element, index, KeyKindNotTakenError, KeyTakenError, filed) {
  const answer = key === NULL ? element : await key(element);
  if (isErrorValue(answer)) return failedAt(key, answer, index);
  const named = keywordFiledFor(beneathTags(answer));
  if (named === null) throw refusingAPart(new KeyKindNotTakenError({ expected: KINDS_A_KEY_FILES_UNDER, actualValue: answer }), index);
  const taken = filed.get(named.name);
  if (taken === undefined) filed.set(named.name, answer);
  else if (compareValues(taken, answer) !== 0) throw refusingAPart(new KeyTakenError({ key: named, taken, actualValue: answer }), index);
  return named;
}

// The elements filed under the keyword the key answers for each, in
// order.
async function bucketsOf(sequence, key, KeyKindNotTakenError, KeyTakenError) {
  const buckets = new Map();
  const filed = new Map();
  for (const [index, element] of sequence.entries()) {
    const bucketKey = await keywordOf(key, element, index, KeyKindNotTakenError, KeyTakenError, filed);
    if (isErrorValue(bucketKey)) return bucketKey;
    if (!buckets.has(bucketKey.name)) buckets.set(bucketKey.name, []);
    buckets.get(bucketKey.name).push(element);
  }
  return buckets;
}

const VecGroupByKeyKindNotTakenError = declareRefusal('vec/groupBy/KeyKindNotTakenError');
const VecGroupByKeyTakenError = declareRefusal('vec/groupBy/KeyTakenError');
const SetGroupByKeyKindNotTakenError = declareRefusal('set/groupBy/KeyKindNotTakenError');
const SetGroupByKeyTakenError = declareRefusal('set/groupBy/KeyTakenError');
registerPrimitive('vec/groupBy', runs(['key'], (vector, key) => bucketsOf(vector, key, VecGroupByKeyKindNotTakenError, VecGroupByKeyTakenError)));
// A set's buckets are sets, so the uniqueness of its elements survives
// the partition.
registerPrimitive('set/groupBy', runs(['key'], async (set, key) => {
  const buckets = await bucketsOf(set, key, SetGroupByKeyKindNotTakenError, SetGroupByKeyTakenError);
  return isErrorValue(buckets) ? buckets : new Map([...buckets].map(([name, elements]) => [name, makeSet(elements)]));
}));

// The last element filed under each keyword the key answers.
async function indexOf(sequence, key, KeyKindNotTakenError, KeyTakenError) {
  const index = new Map();
  const filed = new Map();
  for (const [position, element] of sequence.entries()) {
    const indexKey = await keywordOf(key, element, position, KeyKindNotTakenError, KeyTakenError, filed);
    if (isErrorValue(indexKey)) return indexKey;
    index.set(indexKey.name, element);
  }
  return index;
}

const VecIndexByKeyKindNotTakenError = declareRefusal('vec/indexBy/KeyKindNotTakenError');
const VecIndexByKeyTakenError = declareRefusal('vec/indexBy/KeyTakenError');
registerPrimitive('vec/indexBy', runs(['key'], (vector, key) => indexOf(vector, key, VecIndexByKeyKindNotTakenError, VecIndexByKeyTakenError)));

// ── slices and lookup ──────────────────────────────────────────

// A count is a whole number by the invariant of its input [QSERR#site]; a
// negative one clamps to 0, the same graceful out-of-range handling an
// over-length one gets (`take 99` → the whole container).
registerPrimitive('string/take', (text, count) => Array.from(text).slice(0, Math.max(0, count)).join(''));
registerPrimitive('vec/take', (sequence, count) => sequence.slice(0, Math.max(0, count)));
registerPrimitive('map/take', (map, count) => new Map([...map].slice(0, Math.max(0, count))));
registerPrimitive('string/drop', (text, count) => Array.from(text).slice(Math.max(0, count)).join(''));
registerPrimitive('vec/drop', (sequence, count) => sequence.slice(Math.max(0, count)));
registerPrimitive('map/drop', (map, count) => new Map([...map].slice(Math.max(0, count))));

// Whether a vector holds a value the one order ranks alike with the element
// [QSORD#order]: a set by a search in its one order, and any other vector element by
// element [QSCOL#sequence].
function containsElement(vector, element) {
  if (!isSet(vector)) return vector.some(held => compareValues(held, element) === 0);
  let low = 0;
  let high = vector.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const byOrder = compareValues(vector[middle], element);
    if (byOrder === 0) return true;
    if (byOrder < 0) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

// `has` asks whether a path reads, and of any other value whether it is
// held [QSPTH#has]; `contains` asks whether the element is held alone.
registerPrimitive('vec/has', (vector, element) => (isPath(element) ? pathReads(vector, element) : containsElement(vector, element)));
registerPrimitive('vec/contains', containsElement);

registerPrimitive('vec/prepend', (vector, element) => [element, ...vector]);
registerPrimitive('vec/append', (vector, element) => [...vector, element]);

// `concat` joins the vectors the call gives after its subject [QSCOL#sequence].
registerPrimitive('vec/concat', combines((vector, vectors) => [...vector, ...vectors.flat()]));

// An element `join` writes is a string or a keyword, written as text, and the
// text stands under the tags its strings share [QSTXT#string], [QSCOL#sequence].
const VecJoinElementNotStringOrKeywordError = declareRefusal('vec/join/ElementNotStringOrKeywordError');

registerStateReader('vec/join', (subject, separator, state) => {
  const tally = new TagsInCommon();
  const texts = subject.map((element, at) => {
    const text = beneathTags(element);
    if (typeof text !== 'string' && !isKeyword(text)) throw refusingAPart(new VecJoinElementNotStringOrKeywordError({ actualValue: element }), at);
    const met = isKeyword(text) ? null : tally.meet(element);
    if (met !== null) throw refusingAPart(pairRefused(met, element), at);
    return writtenAsText(text);
  });
  const joined = texts.join(writtenAsText(separator));
  return underSharedTags(joined, tally.tags, state);
});

// ── order and nesting ──────────────────────────────────────────

registerPrimitive(['vec/reverse', 'set/reverse'], sequence => [...sequence].reverse());
registerPrimitive('map/reverse', map => new Map([...map].reverse()));

// `flat` lifts one level of nesting: the inner sequences splice in
// order, and the answer of a set is a set again, so a set of sets
// flattens into their union [QSCOL#sequence], [QSCOL#algebra].
registerPrimitive('vec/flat', sequence => sequence.flatMap(element => (isVec(beneathTags(element)) ? beneathTags(element) : [element])));

// ── the fold ───────────────────────────────────────────────────

// The fold, `reduce seed ~(reducer)`: the reducer folds the value so far and
// each element into the value so far after it; `seed` answers for an empty
// subject, and a failure of the reducer stops the fold at the place of its
// element [QSCOL#reduce].
async function foldOf(entries, seed, reducer) {
  let acc = seed;
  for (const [segment, element] of entries) {
    acc = await reducer(acc, element);
    if (isErrorValue(acc)) return failedAt(reducer, acc, segment);
  }
  return acc;
}

registerPrimitive('vec/reduce', folds(['reducer'], (sequence, seed, reducer) => foldOf(sequence.entries(), seed, reducer)));
registerPrimitive('map/reduce', folds(['reducer'], (map, seed, reducer) => foldOf(map, seed, reducer)));

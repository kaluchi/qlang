// Container primitives, each a plain function over the value the walk served
// and the inputs of the call, an input that takes code arriving closed at the
// call, code run on the element [QSBLD#fn], [QSDSP#walk]: a verb of vectors
// reads the elements in order, a set reaching it through the walk in its one
// order [QSORD#order], [QSDSP#residence], a map's reads its values and keeps its keys
// [QSCOL#map], a string's reads its characters [QSTXT#string], and a refusal
// names the verb that refused [QSERR#site].

import { beneathTags, isNumber, keyword, isErrorValue, isVec, NULL, makeSet, makePath } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { bindPrim, runs } from '../primitives.mjs';
import { resolveBinaryReducer } from '../eval.mjs';
import { atPlace } from '../eval-trace.mjs';
import { keywordFiledFor, KINDS_A_KEY_FILES_UNDER } from './convert.mjs';

// The elements, each beside the fact that names it in a refusal, its index
// from zero in a sequence and its key in a map [D360].
const indexed = sequence => [...sequence].map((element, index) => [{ index }, element]);
const keyed = map => [...map].map(([key, value]) => [{ key: keyword(key) }, value]);

const failedAt = (error, segment) => atPlace(error, makePath([String(segment)]));
const segmentOf = at => at.index ?? at.key.name;

// ── size and ends ──────────────────────────────────────────────

bindPrim('string/count', text => Array.from(text).length);
bindPrim('vec/count', sequence => sequence.length);
bindPrim('map/count', map => map.size);

bindPrim('vec/empty', sequence => sequence.length === 0);
bindPrim('map/empty', map => map.size === 0);

const firstOf = items => (items.length === 0 ? NULL : items[0]);
const lastOf = items => (items.length === 0 ? NULL : items[items.length - 1]);
bindPrim('vec/first', firstOf);
bindPrim('map/first', map => firstOf([...map.values()]));
bindPrim('vec/last', lastOf);
bindPrim('map/last', map => lastOf([...map.values()]));

// ── side by side ───────────────────────────────────────────────
// The elements at each index of the vectors a vector holds, as long as
// the shortest, an element that is no vector refused at its index
// [QSCOL#sequence].
const VecZipElementNotVecError = declareRefusal('vec/zip/ElementNotVecError');
bindPrim('vec/zip', vectors => {
  vectors.forEach((element, index) => {
    if (!Array.isArray(element)) throw new VecZipElementNotVecError({ index, actualValue: element });
  });
  const length = vectors.length === 0 ? 0 : Math.min(...vectors.map(vector => vector.length));
  return Array.from({ length }, (_, index) => vectors.map(vector => vector[index]));
});

// ── sum and mean ───────────────────────────────────────────────

// The number an element holds beneath the tags over it, as `add` reads
// its subject [QSNUM#arithmetic], or undefined.
function numberBeneath(element) {
  const beneath = beneathTags(element);
  return isNumber(beneath) ? beneath : undefined;
}

// The total of the numbers, an element of another kind refused where it
// stands.
function totalOf(elements, ElementNotNumberError) {
  let total = 0;
  for (const [at, element] of elements) {
    const number = numberBeneath(element);
    if (number === undefined) throw new ElementNotNumberError({ ...at, actualValue: element });
    total += number;
  }
  return total;
}

const VecSumElementNotNumberError = declareRefusal('vec/sum/ElementNotNumberError');
const MapSumElementNotNumberError = declareRefusal('map/sum/ElementNotNumberError');
bindPrim('vec/sum', vector => totalOf(indexed(vector), VecSumElementNotNumberError));
bindPrim('map/sum', map => totalOf(keyed(map), MapSumElementNotNumberError));

// The mean of the numbers, a running mean whose every step stays among
// the finite doubles; an empty container has none, and answers null as
// `min` and `max` do [QSCOL#sequence].
function meanOf(elements, ElementNotNumberError) {
  if (elements.length === 0) return NULL;
  let mean = 0;
  for (const [count, [at, element]] of elements.entries()) {
    const number = numberBeneath(element);
    if (number === undefined) throw new ElementNotNumberError({ ...at, actualValue: element });
    const gap = number - mean;
    mean += Number.isFinite(gap) ? gap / (count + 1) : number / (count + 1) - mean / (count + 1);
  }
  return mean;
}

const VecAvgElementNotNumberError = declareRefusal('vec/avg/ElementNotNumberError');
const MapAvgElementNotNumberError = declareRefusal('map/avg/ElementNotNumberError');
bindPrim('vec/avg', vector => meanOf(indexed(vector), VecAvgElementNotNumberError));
bindPrim('map/avg', map => meanOf(keyed(map), MapAvgElementNotNumberError));

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
    if (failed !== null) return failedAt(failed, entry[0]);
    ranked.push({ entry, sortKey });
  }
  return ranked;
}

// The least or the greatest element in the one order, or by the value
// the key answers for each, `pick` naming which side wins a comparison,
// the first of equal ones staying [QSORD#sort].
async function extremeOf(entries, key, pick) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  if (ranked.length === 0) return NULL;
  let best = ranked[0];
  for (const candidate of ranked.slice(1)) {
    if (pick(compareValues(candidate.sortKey, best.sortKey))) best = candidate;
  }
  return best.entry[1];
}

const least = order => order < 0;
const greatest = order => order > 0;
bindPrim('vec/min', runs(['key'], (sequence, key) => extremeOf([...sequence.entries()], key, least)));
bindPrim('map/min', runs(['key'], (map, key) => extremeOf([...map], key, least)));
bindPrim('vec/max', runs(['key'], (sequence, key) => extremeOf([...sequence.entries()], key, greatest)));
bindPrim('map/max', runs(['key'], (map, key) => extremeOf([...map], key, greatest)));

// `sort` orders the elements in the one order, or by the value the key answers
// for each, keeping equal ones in the subject's order; a map orders its
// entries by their values and keeps the keys. A vector the key answers ranks
// element by element, and `desc` reverses one index of it. A key that answers an
// error answers the call, as the key of `groupBy` does, and so does one whose
// vector holds an error [QSERR#flow], [D360].
async function sortedEntries(entries, key) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  ranked.sort((left, right) => compareValues(left.sortKey, right.sortKey));
  return ranked.map(({ entry }) => entry);
}

bindPrim(['vec/sort', 'set/sort'], runs(['key'], async (sequence, key) => {
  const sorted = await sortedEntries([...sequence.entries()], key);
  return isErrorValue(sorted) ? sorted : sorted.map(([, element]) => element);
}));
bindPrim('map/sort', runs(['key'], async (map, key) => {
  const sorted = await sortedEntries([...map], key);
  return isErrorValue(sorted) ? sorted : new Map(sorted);
}));

// ── code on each element ───────────────────────────────────────

// `map` runs its code on each element in order and answers what each
// answered, the first error the code answers answering for the call at the
// place of its element, the elements after it left unrun [QSCOL#each],
// [QSERR#trail]; a map keeps its keys.
async function answersOf(elements, code) {
  const answers = [];
  for (const [at, element] of elements) {
    const answer = await code(element);
    if (isErrorValue(answer)) return failedAt(answer, segmentOf(at));
    answers.push(answer);
  }
  return answers;
}

bindPrim('vec/map', runs(['code'], (sequence, code) => answersOf(indexed(sequence), code)));
bindPrim('map/map', runs(['code'], async (map, code) => {
  const answers = await answersOf(keyed(map), code);
  return isErrorValue(answers) ? answers : new Map([...map.keys()].map((key, index) => [key, answers[index]]));
}));

// ── predicates ─────────────────────────────────────────────────

// A predicate answers a boolean for each element or fails [QSCND#boolean]: the
// error it answered is handed on at the place of the element [QSERR#trail], and
// another answer is refused where the element stands.
async function verdictOf(predicate, at, element, ConditionNotBooleanError) {
  const verdict = await predicate(element);
  if (isErrorValue(verdict)) return failedAt(verdict, segmentOf(at));
  if (typeof verdict === 'boolean') return verdict;
  throw new ConditionNotBooleanError({ ...at, actualValue: verdict });
}

// `filter` keeps the elements whose predicate answers true, and a map the
// entries whose values do.
async function keptElements(sequence, predicate, ConditionNotBooleanError) {
  const kept = [];
  for (const [at, element] of indexed(sequence)) {
    const verdict = await verdictOf(predicate, at, element, ConditionNotBooleanError);
    if (isErrorValue(verdict)) return verdict;
    if (verdict) kept.push(element);
  }
  return kept;
}

async function keptEntries(map, predicate, ConditionNotBooleanError) {
  const kept = new Map();
  for (const [key, value] of map) {
    const verdict = await verdictOf(predicate, { key: keyword(key) }, value, ConditionNotBooleanError);
    if (isErrorValue(verdict)) return verdict;
    if (verdict) kept.set(key, value);
  }
  return kept;
}

const VecFilterConditionNotBooleanError = declareRefusal('vec/filter/ConditionNotBooleanError');
const MapFilterConditionNotBooleanError = declareRefusal('map/filter/ConditionNotBooleanError');
bindPrim('vec/filter', runs(['predicate'], (vector, predicate) => keptElements(vector, predicate, VecFilterConditionNotBooleanError)));
bindPrim('map/filter', runs(['predicate'], (map, predicate) => keptEntries(map, predicate, MapFilterConditionNotBooleanError)));

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
bindPrim('vec/every', runs(['predicate'], (vector, predicate) => firstVerdict(indexed(vector), predicate, false, VecEveryConditionNotBooleanError)));
bindPrim('map/every', runs(['predicate'], (map, predicate) => firstVerdict(keyed(map), predicate, false, MapEveryConditionNotBooleanError)));

const VecAnyConditionNotBooleanError = declareRefusal('vec/any/ConditionNotBooleanError');
const MapAnyConditionNotBooleanError = declareRefusal('map/any/ConditionNotBooleanError');
bindPrim('vec/any', runs(['predicate'], (vector, predicate) => firstVerdict(indexed(vector), predicate, true, VecAnyConditionNotBooleanError)));
bindPrim('map/any', runs(['predicate'], (map, predicate) => firstVerdict(keyed(map), predicate, true, MapAnyConditionNotBooleanError)));

// ── partitions ─────────────────────────────────────────────────

// The keyword the key of `groupBy` or `indexBy` answers for an element, the
// one `toKeyword` names it by, a key of another kind refused at its element
// with the kinds a key files under as `:expected`, or the error it answered;
// without a key the element is its own, and two values of the key that file
// under one keyword meet, `1` and `"1"` under `:"1"`, the second refused
// [QSCOL#group].
async function keywordOf(key, element, index, KeyKindNotTakenError, KeyTakenError, filed) {
  const answer = key === NULL ? element : await key(element);
  if (isErrorValue(answer)) return failedAt(answer, index);
  const named = keywordFiledFor(answer);
  if (named === null) throw new KeyKindNotTakenError({ index, expected: KINDS_A_KEY_FILES_UNDER, actualValue: answer });
  const taken = filed.get(named.name);
  if (taken === undefined) filed.set(named.name, answer);
  else if (compareValues(taken, answer) !== 0) throw new KeyTakenError({ key: named, taken, index, actualValue: answer });
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
bindPrim('vec/groupBy', runs(['key'], (vector, key) => bucketsOf(vector, key, VecGroupByKeyKindNotTakenError, VecGroupByKeyTakenError)));
// A set's buckets are sets, so the uniqueness of its elements survives
// the partition.
bindPrim('set/groupBy', runs(['key'], async (set, key) => {
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
bindPrim('vec/indexBy', runs(['key'], (vector, key) => indexOf(vector, key, VecIndexByKeyKindNotTakenError, VecIndexByKeyTakenError)));

// ── slices and lookup ──────────────────────────────────────────

// A count is a whole number by the invariant of its input [QSERR#site]; a
// negative one clamps to 0, the same graceful out-of-range handling an
// over-length one gets (`take 99` → the whole container).
bindPrim('string/take', (text, count) => Array.from(text).slice(0, Math.max(0, count)).join(''));
bindPrim('vec/take', (sequence, count) => sequence.slice(0, Math.max(0, count)));
bindPrim('map/take', (map, count) => new Map([...map].slice(0, Math.max(0, count))));
bindPrim('string/drop', (text, count) => Array.from(text).slice(Math.max(0, count)).join(''));
bindPrim('vec/drop', (sequence, count) => sequence.slice(Math.max(0, count)));
bindPrim('map/drop', (map, count) => new Map([...map].slice(Math.max(0, count))));

// ── order and nesting ──────────────────────────────────────────

bindPrim(['vec/reverse', 'set/reverse'], sequence => [...sequence].reverse());
bindPrim('map/reverse', map => new Map([...map].reverse()));

// `flat` lifts one level of nesting: the inner sequences splice in
// order, and the answer of a set is a set again, so a set of sets
// flattens into their union [QSCOL#sequence], [QSCOL#algebra].
bindPrim('vec/flat', sequence => sequence.flatMap(element => (isVec(element) ? element : [element])));

// ── the fold ───────────────────────────────────────────────────

// The fold, `reduce seed ~(reducer)`: a quote of one word names the verb
// called as the pipe calls it, `acc | add element`, the element the first of
// its args; any other code runs on the pair of the value so far and the
// element, and its answer is the value so far after it; `seed` answers for an
// empty subject, and a failure of the reducer stops the fold at the place of
// its element [QSCOL#reduce].
async function foldOf(entries, seed, reducer) {
  const combine = resolveBinaryReducer(reducer) ?? ((acc, element) => reducer([acc, element]));
  let acc = seed;
  for (const [segment, element] of entries) {
    acc = await combine(acc, element);
    if (isErrorValue(acc)) return failedAt(acc, segment);
  }
  return acc;
}

bindPrim('vec/reduce', runs(['reducer'], (sequence, seed, reducer) => foldOf(sequence.entries(), seed, reducer)));
bindPrim('map/reduce', runs(['reducer'], (map, seed, reducer) => foldOf(map, seed, reducer)));

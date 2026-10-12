// Container primitives, each a plain function over the value the walk
// served and the parts of the call's args [D167]. Every word of a kind
// has its own, since the walk of the subject's tags already chose the
// word: a vector and a set, which read alike, share the one that reads
// the elements in order [D16], a map's reads its values and keeps its
// keys [D15], a string's reads its characters [D132], and a refusal
// names the word that refused [D172]. A part that takes code arrives
// closed at the call, code run on the element [D73], [D167].

import { isBoolean, isKeyword, isString, isNumber, isTag, keyword, isErrorValue, isVec, NULL, makeSet, makeTaggedInstance, makeTag } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { resolveBinaryReducer } from '../eval.mjs';

const DESC_TAG = makeTag('desc');

// The elements beside the fact that names the place of each in a
// refusal: a sequence's index, from zero, and a map's key.
const indexed = sequence => [...sequence].map((element, index) => [{ index }, element]);
const keyed = map => [...map].map(([key, value]) => [{ key: keyword(key) }, value]);

// ── size and ends ──────────────────────────────────────────────

bindPrim('string/count', text => Array.from(text).length);
bindPrim(['vec/count', 'set/count'], sequence => sequence.length);
bindPrim('map/count', map => map.size);

bindPrim(['vec/empty', 'set/empty'], sequence => sequence.length === 0);
bindPrim('map/empty', map => map.size === 0);

const firstOf = items => (items.length === 0 ? NULL : items[0]);
const lastOf = items => (items.length === 0 ? NULL : items[items.length - 1]);
bindPrim(['vec/first', 'set/first'], firstOf);
bindPrim('map/first', map => firstOf([...map.values()]));
bindPrim(['vec/last', 'set/last'], lastOf);
bindPrim('map/last', map => lastOf([...map.values()]));

// ── side by side ───────────────────────────────────────────────
// The elements at each index of the vectors a vector holds, as long as
// the shortest, an element that is no vector refused at its index
// [D194].
const VecZipElementNotVecError = declareRefusal('vec/zip/ElementNotVecError');
bindPrim('vec/zip', vectors => {
  vectors.forEach((element, index) => {
    if (!Array.isArray(element)) throw new VecZipElementNotVecError({ index, actualValue: element });
  });
  const length = vectors.length === 0 ? 0 : Math.min(...vectors.map(vector => vector.length));
  return Array.from({ length }, (_, index) => vectors.map(vector => vector[index]));
});

// ── sum and mean ───────────────────────────────────────────────

// The total of the numbers, an element of another kind refused where it
// stands.
function totalOf(places, ElementNotNumberError) {
  let total = 0;
  for (const [place, element] of places) {
    if (!isNumber(element)) throw new ElementNotNumberError({ ...place, actualValue: element });
    total += element;
  }
  return total;
}

const VecSumElementNotNumberError = declareRefusal('vec/sum/ElementNotNumberError');
const SetSumElementNotNumberError = declareRefusal('set/sum/ElementNotNumberError');
const MapSumElementNotNumberError = declareRefusal('map/sum/ElementNotNumberError');
bindPrim('vec/sum', vector => totalOf(indexed(vector), VecSumElementNotNumberError));
bindPrim('set/sum', set => totalOf(indexed(set), SetSumElementNotNumberError));
bindPrim('map/sum', map => totalOf(keyed(map), MapSumElementNotNumberError));

// The mean of the numbers, a running mean whose every step stays among
// the finite doubles; an empty container has none, and answers null as
// `min` and `max` do [D147].
function meanOf(places, ElementNotNumberError) {
  if (places.length === 0) return NULL;
  let mean = 0;
  for (const [count, [place, element]] of places.entries()) {
    if (!isNumber(element)) throw new ElementNotNumberError({ ...place, actualValue: element });
    const gap = element - mean;
    mean += Number.isFinite(gap) ? gap / (count + 1) : element / (count + 1) - mean / (count + 1);
  }
  return mean;
}

const VecAvgElementNotNumberError = declareRefusal('vec/avg/ElementNotNumberError');
const SetAvgElementNotNumberError = declareRefusal('set/avg/ElementNotNumberError');
const MapAvgElementNotNumberError = declareRefusal('map/avg/ElementNotNumberError');
bindPrim('vec/avg', vector => meanOf(indexed(vector), VecAvgElementNotNumberError));
bindPrim('set/avg', set => meanOf(indexed(set), SetAvgElementNotNumberError));
bindPrim('map/avg', map => meanOf(keyed(map), MapAvgElementNotNumberError));

// ── ranking ────────────────────────────────────────────────────

// The error a key answered for an element, the key itself or a part of
// the vector it answered, or null [D87], [D140].
function errorOfKey(rankKey) {
  if (isErrorValue(rankKey)) return rankKey;
  return isVec(rankKey) ? rankKey.find(isErrorValue) ?? null : null;
}

// Each entry beside the value it ranks by, its own without a key, an
// error among the elements ranked as the one order ranks it, or the
// error a key answered.
async function keyedEntries(entries, key) {
  const ranked = [];
  for (const entry of entries) {
    if (key === NULL) {
      ranked.push({ entry, sortKey: entry[1] });
      continue;
    }
    const sortKey = await key(entry[1]);
    const failed = errorOfKey(sortKey);
    if (failed !== null) return failed;
    ranked.push({ entry, sortKey });
  }
  return ranked;
}

// The least or the greatest element in the one order, or by the value
// the key answers for each, `pick` naming which side wins a comparison,
// the first of equal ones staying [D140].
async function extremeOf(items, key, pick) {
  const ranked = await keyedEntries(items.map(item => [null, item]), key);
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
bindPrim(['vec/min', 'set/min'], (sequence, key) => extremeOf([...sequence], key, least));
bindPrim('map/min', (map, key) => extremeOf([...map.values()], key, least));
bindPrim(['vec/max', 'set/max'], (sequence, key) => extremeOf([...sequence], key, greatest));
bindPrim('map/max', (map, key) => extremeOf([...map.values()], key, greatest));

// `sort` orders the elements in the one order, or by the value the key
// answers for each, keeping equal ones in the subject's order; a map
// orders its entries by their values and keeps the keys. A vector the key
// answers ranks element by element, and `desc` reverses a place of it.
// A key that answers an error answers the call, as the key of `groupBy`
// does, and so does one whose vector holds an error [D87], [D140].
async function sortedEntries(entries, key) {
  const ranked = await keyedEntries(entries, key);
  if (isErrorValue(ranked)) return ranked;
  ranked.sort((left, right) => compareValues(left.sortKey, right.sortKey));
  return ranked.map(({ entry }) => entry);
}

bindPrim(['vec/sort', 'set/sort'], async (sequence, key) => {
  const sorted = await sortedEntries([...sequence.entries()], key);
  return isErrorValue(sorted) ? sorted : sorted.map(([, element]) => element);
});
bindPrim('map/sort', async (map, key) => {
  const sorted = await sortedEntries([...map], key);
  return isErrorValue(sorted) ? sorted : new Map(sorted);
});

// ── code on each element ───────────────────────────────────────

// `map` runs its code on each element in order and answers what each
// answered, the first error the code answers answering for the call, the
// elements after it left unrun [D182]; a map keeps its keys.
async function answersOf(elements, code) {
  const answers = [];
  for (const element of elements) {
    const answer = await code(element);
    if (isErrorValue(answer)) return answer;
    answers.push(answer);
  }
  return answers;
}

bindPrim(['vec/map', 'set/map'], (sequence, code) => answersOf(sequence, code));
bindPrim('map/map', async (map, code) => {
  const answers = await answersOf(map.values(), code);
  return isErrorValue(answers) ? answers : new Map([...map.keys()].map((key, index) => [key, answers[index]]));
});

// ── predicates ─────────────────────────────────────────────────

// A predicate answers a boolean for each element or fails [D14]: the
// error it answered is handed on, and another answer is refused where
// the element stands.
async function verdictOf(predicate, place, element, ConditionNotBooleanError) {
  const verdict = await predicate(element);
  if (isErrorValue(verdict) || typeof verdict === 'boolean') return verdict;
  throw new ConditionNotBooleanError({ ...place, actualValue: verdict });
}

// `filter` keeps the elements whose predicate answers true, and a map the
// entries whose values do.
async function keptElements(sequence, predicate, ConditionNotBooleanError) {
  const kept = [];
  for (const [place, element] of indexed(sequence)) {
    const verdict = await verdictOf(predicate, place, element, ConditionNotBooleanError);
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
const SetFilterConditionNotBooleanError = declareRefusal('set/filter/ConditionNotBooleanError');
const MapFilterConditionNotBooleanError = declareRefusal('map/filter/ConditionNotBooleanError');
bindPrim('vec/filter', (vector, predicate) => keptElements(vector, predicate, VecFilterConditionNotBooleanError));
bindPrim('set/filter', (set, predicate) => keptElements(set, predicate, SetFilterConditionNotBooleanError));
bindPrim('map/filter', (map, predicate) => keptEntries(map, predicate, MapFilterConditionNotBooleanError));

// Whether the predicate of every element answers true, the first false
// answering for the call, and whether the predicate of any does, the
// first true answering.
async function firstVerdict(places, predicate, decisive, ConditionNotBooleanError) {
  for (const [place, element] of places) {
    const verdict = await verdictOf(predicate, place, element, ConditionNotBooleanError);
    if (isErrorValue(verdict) || verdict === decisive) return verdict;
  }
  return !decisive;
}

const VecEveryConditionNotBooleanError = declareRefusal('vec/every/ConditionNotBooleanError');
const SetEveryConditionNotBooleanError = declareRefusal('set/every/ConditionNotBooleanError');
const MapEveryConditionNotBooleanError = declareRefusal('map/every/ConditionNotBooleanError');
bindPrim('vec/every', (vector, predicate) => firstVerdict(indexed(vector), predicate, false, VecEveryConditionNotBooleanError));
bindPrim('set/every', (set, predicate) => firstVerdict(indexed(set), predicate, false, SetEveryConditionNotBooleanError));
bindPrim('map/every', (map, predicate) => firstVerdict(keyed(map), predicate, false, MapEveryConditionNotBooleanError));

const VecAnyConditionNotBooleanError = declareRefusal('vec/any/ConditionNotBooleanError');
const SetAnyConditionNotBooleanError = declareRefusal('set/any/ConditionNotBooleanError');
const MapAnyConditionNotBooleanError = declareRefusal('map/any/ConditionNotBooleanError');
bindPrim('vec/any', (vector, predicate) => firstVerdict(indexed(vector), predicate, true, VecAnyConditionNotBooleanError));
bindPrim('set/any', (set, predicate) => firstVerdict(indexed(set), predicate, true, SetAnyConditionNotBooleanError));
bindPrim('map/any', (map, predicate) => firstVerdict(keyed(map), predicate, true, MapAnyConditionNotBooleanError));

// ── partitions ─────────────────────────────────────────────────

// The keyword the key of `groupBy` or `indexBy` answers for an element:
// a string or a number filed under the keyword of its text [D130], a
// boolean or null under that of its literal and a tag name under that of
// its name [D201], or the error it answered; without a key the element
// is its own [D135]. Two values of the key that file under one keyword
// meet, `1` and `"1"` under `:"1"`, and the second is refused [D228].
async function keywordOf(key, element, index, KeyNotKeywordError, KeyTakenError, filed) {
  const answer = key === NULL ? element : await key(element);
  if (isErrorValue(answer)) return answer;
  const named = isKeyword(answer) ? answer
    : isString(answer) || isNumber(answer) || isBoolean(answer) || answer === NULL ? keyword(String(answer))
    : isTag(answer) ? keyword(answer.name)
    : null;
  if (named === null) throw new KeyNotKeywordError({ index, actualValue: answer });
  const taken = filed.get(named.name);
  if (taken === undefined) filed.set(named.name, answer);
  else if (compareValues(taken, answer) !== 0) throw new KeyTakenError({ key: named, taken, index, actualValue: answer });
  return named;
}

// The elements filed under the keyword the key answers for each, in
// order.
async function bucketsOf(sequence, key, KeyNotKeywordError, KeyTakenError) {
  const buckets = new Map();
  const filed = new Map();
  for (const [index, element] of sequence.entries()) {
    const bucketKey = await keywordOf(key, element, index, KeyNotKeywordError, KeyTakenError, filed);
    if (isErrorValue(bucketKey)) return bucketKey;
    if (!buckets.has(bucketKey.name)) buckets.set(bucketKey.name, []);
    buckets.get(bucketKey.name).push(element);
  }
  return buckets;
}

const VecGroupByKeyNotKeywordError = declareRefusal('vec/groupBy/KeyNotKeywordError');
const VecGroupByKeyTakenError = declareRefusal('vec/groupBy/KeyTakenError');
const SetGroupByKeyNotKeywordError = declareRefusal('set/groupBy/KeyNotKeywordError');
const SetGroupByKeyTakenError = declareRefusal('set/groupBy/KeyTakenError');
bindPrim('vec/groupBy', (vector, key) => bucketsOf(vector, key, VecGroupByKeyNotKeywordError, VecGroupByKeyTakenError));
// A set's buckets are sets, so the uniqueness of its elements survives
// the partition.
bindPrim('set/groupBy', async (set, key) => {
  const buckets = await bucketsOf(set, key, SetGroupByKeyNotKeywordError, SetGroupByKeyTakenError);
  return isErrorValue(buckets) ? buckets : new Map([...buckets].map(([name, elements]) => [name, makeSet(elements)]));
});

// The last element filed under each keyword the key answers.
async function indexOf(sequence, key, KeyNotKeywordError, KeyTakenError) {
  const index = new Map();
  const filed = new Map();
  for (const [position, element] of sequence.entries()) {
    const indexKey = await keywordOf(key, element, position, KeyNotKeywordError, KeyTakenError, filed);
    if (isErrorValue(indexKey)) return indexKey;
    index.set(indexKey.name, element);
  }
  return index;
}

const VecIndexByKeyNotKeywordError = declareRefusal('vec/indexBy/KeyNotKeywordError');
const VecIndexByKeyTakenError = declareRefusal('vec/indexBy/KeyTakenError');
const SetIndexByKeyNotKeywordError = declareRefusal('set/indexBy/KeyNotKeywordError');
const SetIndexByKeyTakenError = declareRefusal('set/indexBy/KeyTakenError');
bindPrim('vec/indexBy', (vector, key) => indexOf(vector, key, VecIndexByKeyNotKeywordError, VecIndexByKeyTakenError));
bindPrim('set/indexBy', (set, key) => indexOf(set, key, SetIndexByKeyNotKeywordError, SetIndexByKeyTakenError));

// ── slices and lookup ──────────────────────────────────────────

// A count is a whole number by the invariant of its part [D172]; a negative
// one clamps to 0, the same graceful out-of-range handling an
// over-length one gets (`take 99` → the whole container).
bindPrim('string/take', (text, count) => Array.from(text).slice(0, Math.max(0, count)).join(''));
bindPrim(['vec/take', 'set/take'], (sequence, count) => sequence.slice(0, Math.max(0, count)));
bindPrim('map/take', (map, count) => new Map([...map].slice(0, Math.max(0, count))));
bindPrim('string/drop', (text, count) => Array.from(text).slice(Math.max(0, count)).join(''));
bindPrim(['vec/drop', 'set/drop'], (sequence, count) => sequence.slice(Math.max(0, count)));
bindPrim('map/drop', (map, count) => new Map([...map].slice(Math.max(0, count))));

// `at` — indexed access with Array.prototype.at-style negative indices
// on a sequence, a set indexing in its one order, and a soft lookup by
// a keyword or a string on a map; a miss answers the default the call
// gives, null when it gives none, where the strict `/key` projection
// refuses, and a soft read of null answers it too, so soft reads chain
// [D145], [D166].
bindPrim('null/at', (subject, place, fallback) => fallback);
bindPrim(['vec/at', 'set/at'], (sequence, index, fallback) => {
  const resolvedIndex = index < 0 ? sequence.length + index : index;
  return (resolvedIndex >= 0 && resolvedIndex < sequence.length) ? sequence[resolvedIndex] : fallback;
});
bindPrim('map/at', (map, key, fallback) => {
  const lookupKey = isKeyword(key) ? key.name : key;
  return map.has(lookupKey) ? map.get(lookupKey) : fallback;
});

// ── reshaping ──────────────────────────────────────────────────

// `desc` lays `::desc` over a value, which reverses its place in the one
// order among the values under that tag [D140].
bindPrim('any/desc', value => makeTaggedInstance(DESC_TAG, value));

// `distinct` is the constructor of the set [D16]: the elements of a
// vector in the one order without duplicates, and a set as it is.
bindPrim('vec/distinct', vector => makeSet(vector));
bindPrim('set/distinct', set => set);

bindPrim(['vec/reverse', 'set/reverse'], sequence => [...sequence].reverse());
bindPrim('map/reverse', map => new Map([...map].reverse()));

// `flat` lifts one level of nesting: the inner sequences splice in
// order, and the answer of a set is a set again, so a set of sets
// flattens into their union.
bindPrim(['vec/flat', 'set/flat'], sequence => sequence.flatMap(element => (isVec(element) ? element : [element])));

// ── the fold ───────────────────────────────────────────────────

// `reduce seed ~(reducer)` — the universal left-fold: a quote of one word
// is the word called as the pipe calls it, `acc | add element`, the
// element the first part of its args [D90], [D224]; any other code runs
// on the pair of the value so far and the element, and its answer is the
// value so far after it [D233]. `seed` answers for an empty subject, and
// a failure of the reducer stops the fold.
async function foldOf(elements, seed, reducer) {
  const combine = resolveBinaryReducer(reducer) ?? ((acc, element) => reducer([acc, element]));
  let acc = seed;
  for (const element of elements) {
    acc = await combine(acc, element);
    if (isErrorValue(acc)) return acc;
  }
  return acc;
}

bindPrim(['vec/reduce', 'set/reduce'], (sequence, seed, reducer) => foldOf(sequence, seed, reducer));
bindPrim('map/reduce', (map, seed, reducer) => foldOf(map.values(), seed, reducer));

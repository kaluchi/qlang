// Container primitives, each a plain function over the value the walk
// served and the parts of the call's object [D167]. The names reside on
// `::vec`, `::set` and `::map`
// (lib/qlang/vec.qlang, set.qlang, map.qlang) under the contracts on
// `::any`, which refuse a subject no residence serves. A set is the
// vector in the one order [D16] and a map's elements are its values
// [D15], so one primitive serves the kinds that read alike and branches on
// the map where it keeps keys; a part that takes code arrives closed at
// the call, a lambda over the element [D73], [D167].

import { isQSet, isKeyword, isString, isNumber, keyword, isErrorValue, isVec, NULL, isQMap, makeSet, makeTaggedInstance, makeTagKeyword } from '../types.mjs';

const DESC_TAG = makeTagKeyword('desc');
import { compareValues } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { resolveBinaryReducer } from '../eval.mjs';

// A condition answers a boolean or fails [D14]; the refusal names the
// element whose condition answered another kind.
const AnyFilterConditionNotBooleanError = declareRefusal('any/FilterConditionNotBooleanError');
const AnyEveryConditionNotBooleanError  = declareRefusal('any/EveryConditionNotBooleanError');
const AnyAnyConditionNotBooleanError    = declareRefusal('any/AnyConditionNotBooleanError');

function booleanOf(answer, index, ErrorCls) {
  if (typeof answer !== 'boolean') throw new ErrorCls({ index, actualValue: answer });
  return answer;
}

const AnyGroupByKeyNotKeywordError = declareRefusal('any/GroupByKeyNotKeywordError');
const AnyIndexByKeyNotKeywordError = declareRefusal('any/IndexByKeyNotKeywordError');

const AnySumElementNotNumberError = declareRefusal('any/SumElementNotNumberError');
const AnyReduceReducerNotBinaryError = declareRefusal('any/ReduceReducerNotBinaryError');

// The elements a container holds, a map's its values.
function elementsOf(container) {
  return isQMap(container) ? [...container.values()] : container;
}

// A string counts, takes and drops by its characters, each code point one
// [D132].
function sizeOf(container) {
  if (isString(container)) return Array.from(container).length;
  return isQMap(container) ? container.size : container.length;
}

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
  const keyed = [];
  for (const entry of entries) {
    if (key === NULL) {
      keyed.push({ entry, sortKey: entry[1] });
      continue;
    }
    const sortKey = await key(entry[1]);
    const failed = errorOfKey(sortKey);
    if (failed !== null) return failed;
    keyed.push({ entry, sortKey });
  }
  return keyed;
}

// The least or the greatest element in the one order, or by the value
// the key answers for each, `pick` naming which side wins a comparison,
// the first of equal ones staying [D140].
async function extremeOf(container, key, pick) {
  const keyed = await keyedEntries(elementsOf(container).map(item => [null, item]), key);
  if (isErrorValue(keyed)) return keyed;
  if (keyed.length === 0) return NULL;
  let best = keyed[0];
  for (const candidate of keyed.slice(1)) {
    if (pick(compareValues(candidate.sortKey, best.sortKey))) best = candidate;
  }
  return best.entry[1];
}

bindPrim(['string/count', 'vec/count', 'set/count', 'map/count'], container => sizeOf(container));
bindPrim(['vec/empty', 'set/empty', 'map/empty'], container => sizeOf(container) === 0);

bindPrim(['vec/first', 'set/first', 'map/first'], container => {
  const items = elementsOf(container);
  return items.length === 0 ? NULL : items[0];
});

bindPrim(['vec/last', 'set/last', 'map/last'], container => {
  const items = elementsOf(container);
  return items.length === 0 ? NULL : items[items.length - 1];
});

bindPrim(['vec/sum', 'set/sum', 'map/sum'], container => {
  const items = elementsOf(container);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') throw new AnySumElementNotNumberError({ index: i, actualValue: items[i] });
    total += items[i];
  }
  return total;
});

// The mean of the numbers, kept as a running mean so no partial sum
// leaves the finite doubles; an empty container has none, and answers
// null as `min` and `max` do [D147].
const AnyAvgElementNotNumberError = declareRefusal('any/AvgElementNotNumberError');
bindPrim(['vec/avg', 'set/avg', 'map/avg'], container => {
  const items = elementsOf(container);
  if (items.length === 0) return NULL;
  let mean = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') throw new AnyAvgElementNotNumberError({ index: i, actualValue: items[i] });
    mean += (items[i] - mean) / (i + 1);
  }
  return mean;
});

bindPrim(['vec/min', 'set/min', 'map/min'], (container, key) => extremeOf(container, key, order => order < 0));
bindPrim(['vec/max', 'set/max', 'map/max'], (container, key) => extremeOf(container, key, order => order > 0));

// `filter` keeps the entries of a map whose values pass, and the
// elements of a sequence that do; the page's `::keeps~()` reads the
// answer back as the subject's own kind, a set through its constructor.
bindPrim(['vec/filter', 'set/filter', 'map/filter'], async (container, predicate) => {
  const kept = [];
  for (const [index, entry] of [...(isQMap(container) ? container : container.entries())].entries()) {
    const verdict = await predicate(entry[1]);
    if (isErrorValue(verdict)) return verdict;
    if (booleanOf(verdict, index, AnyFilterConditionNotBooleanError)) kept.push(entry);
  }
  return isQMap(container) ? new Map(kept) : kept.map(([, element]) => element);
});

bindPrim(['vec/every', 'set/every', 'map/every'], async (container, predicate) => {
  for (const [index, element] of elementsOf(container).entries()) {
    const verdict = await predicate(element);
    if (isErrorValue(verdict)) return verdict;
    if (!booleanOf(verdict, index, AnyEveryConditionNotBooleanError)) return false;
  }
  return true;
});

bindPrim(['vec/any', 'set/any', 'map/any'], async (container, predicate) => {
  for (const [index, element] of elementsOf(container).entries()) {
    const verdict = await predicate(element);
    if (isErrorValue(verdict)) return verdict;
    if (booleanOf(verdict, index, AnyAnyConditionNotBooleanError)) return true;
  }
  return false;
});

// The keyword the key of `groupBy` or `indexBy` answers for an element,
// a string or a number filed under the keyword of its text [D130], or the
// error it answered; without a key the element is its own [D135].
async function keywordOf(key, element, index, ErrorCls) {
  const answer = key === NULL ? element : await key(element);
  if (isErrorValue(answer) || isKeyword(answer)) return answer;
  if (isString(answer) || isNumber(answer)) return keyword(String(answer));
  throw new ErrorCls({ index, actualValue: answer });
}

// groupBy on a Set subject mints Set-typed buckets so the value-class
// signal of the original sequence (uniqueness) survives partitioning.
bindPrim(['vec/groupBy', 'set/groupBy'], async (sequence, key) => {
  const buckets = new Map();
  for (const [index, element] of sequence.entries()) {
    const bucketKey = await keywordOf(key, element, index, AnyGroupByKeyNotKeywordError);
    if (isErrorValue(bucketKey)) return bucketKey;
    if (!buckets.has(bucketKey.name)) buckets.set(bucketKey.name, []);
    buckets.get(bucketKey.name).push(element);
  }
  if (isQSet(sequence)) {
    for (const [bucketName, bucketItems] of buckets) buckets.set(bucketName, makeSet(bucketItems));
  }
  return buckets;
});

bindPrim(['vec/indexBy', 'set/indexBy'], async (sequence, key) => {
  const index = new Map();
  for (const [position, element] of sequence.entries()) {
    const indexKey = await keywordOf(key, element, position, AnyIndexByKeyNotKeywordError);
    if (isErrorValue(indexKey)) return indexKey;
    index.set(indexKey.name, element);
  }
  return index;
});

// `sort` orders the elements in the one order, or by the value the key
// answers for each, keeping equal ones in the subject's order; a map
// orders its entries by their values and keeps the keys. A vector the key
// answers ranks element by element, and `desc` reverses a place of it.
// A key that answers an error answers the call, as the key of `groupBy`
// does, and so does one whose vector holds an error [D87], [D140].
bindPrim(['vec/sort', 'set/sort', 'map/sort'], async (container, key) => {
  const entries = [...(isQMap(container) ? container : container.entries())];
  const keyed = await keyedEntries(entries, key);
  if (isErrorValue(keyed)) return keyed;
  keyed.sort((left, right) => compareValues(left.sortKey, right.sortKey));
  const sorted = keyed.map(({ entry }) => entry);
  return isQMap(container) ? new Map(sorted) : sorted.map(([, element]) => element);
});

// A negative count clamps to 0, the same graceful out-of-range handling
// an over-length count gets (`take 99` → the whole container).
function sliceOf(container, start, end) {
  if (isString(container)) return Array.from(container).slice(start, end).join('');
  return isQMap(container) ? new Map([...container].slice(start, end)) : container.slice(start, end);
}

bindPrim(['string/take', 'vec/take', 'set/take', 'map/take'], (container, count) => sliceOf(container, 0, Math.max(0, count)));
bindPrim(['string/drop', 'vec/drop', 'set/drop', 'map/drop'], (container, count) => sliceOf(container, Math.max(0, count)));

// `at` — indexed access with Array.prototype.at-style negative indices
// on a sequence, a set indexing in its one order, and a soft lookup by
// a keyword or a string on a map; a miss answers the default the call
// gives, null when it gives none, where the strict `/key` projection
// refuses, and a soft read of null answers it too, so soft reads chain
// [D145], [D166].
bindPrim(['null/at', 'vec/at', 'set/at', 'map/at'], (container, place, fallback) => {
  if (container === NULL) return fallback;
  if (isQMap(container)) {
    const lookupKey = isKeyword(place) ? place.name : place;
    return container.has(lookupKey) ? container.get(lookupKey) : fallback;
  }
  const resolvedIndex = place < 0 ? container.length + place : place;
  return (resolvedIndex >= 0 && resolvedIndex < container.length) ? container[resolvedIndex] : fallback;
});

// `distinct` is the constructor of the set [D16]: the elements of a
// vector in the one order without duplicates. A set passes through as
// it is.
// `desc` lays `::desc` over a value, which reverses its place in the one
// order among the values under that tag [D140].
bindPrim('any/desc', value => makeTaggedInstance(DESC_TAG, value));

bindPrim(['vec/distinct', 'set/distinct'], sequence => (isQSet(sequence) ? sequence : makeSet(sequence)));

bindPrim(['vec/reverse', 'set/reverse', 'map/reverse'], container => (isQMap(container) ? new Map([...container].reverse()) : [...container].reverse()));

// `flat` lifts one level of nesting: the inner sequences splice in
// order, and the page's `::keeps~()` mints a set's answer as a set
// again, so a set of sets flattens into their union.
bindPrim(['vec/flat', 'set/flat'], sequence => sequence.flatMap(element => (isVec(element) ? element : [element])));

// `reduce seed ~(reducer)` — the universal left-fold: the reducer is
// applied as `reducer(acc, element)`, a name of two places through its
// bound form (`acc | add element`), the element the first part of its
// object [D67], [D167]; `seed` answers for an empty subject, and a
// reducer error stops the fold.
bindPrim(['vec/reduce', 'set/reduce', 'map/reduce'], async (container, seed, reducer) => {
  const combine = resolveBinaryReducer(reducer);
  if (combine === null) throw new AnyReduceReducerNotBinaryError();
  let acc = seed;
  for (const element of elementsOf(container)) {
    acc = await combine(acc, element);
    if (isErrorValue(acc)) return acc;
  }
  return acc;
});

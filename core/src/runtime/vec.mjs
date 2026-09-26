// Container primitives, each a plain function over the value the head of
// its verb checked [D72]. The verbs reside on `::vec`, `::set` and `::map`
// (lib/qlang/vec.qlang, set.qlang, map.qlang) under the contracts on
// `::qlang/any`, which refuse a subject no residence serves. A set is the
// vector in the one order [D16] and a map's elements are its values
// [D15], so one primitive serves the kinds that read alike and branches on
// the map where it keeps keys; a slot of code arrives closed at the call,
// a lambda over the element [D73].

import { isQSet, isKeyword, isErrorValue, isVec, typeKeyword, NULL, isQMap, makeSet } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareModifierError, declareElementError } from '../operand-errors.mjs';
import { declareShapeError, declareNumericDomainError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { resolveBinaryReducer } from '../eval.mjs';

// A condition answers a boolean or fails at its slot [D14]; the refusal
// names the element whose condition answered another kind.
const conditionRefusal = operand => ({ index, actualType }) =>
  `${operand} takes a boolean from its condition, element ${index} answered ${actualType.name}`;
const FilterConditionNotBooleanError = declareShapeError('FilterConditionNotBooleanError',
  conditionRefusal('filter'), { operand: 'filter', expectedType: 'boolean' });
const EveryConditionNotBooleanError  = declareShapeError('EveryConditionNotBooleanError',
  conditionRefusal('every'), { operand: 'every', expectedType: 'boolean' });
const AnyConditionNotBooleanError    = declareShapeError('AnyConditionNotBooleanError',
  conditionRefusal('any'), { operand: 'any', expectedType: 'boolean' });

function booleanOf(answer, index, ErrorCls) {
  if (typeof answer !== 'boolean') throw new ErrorCls({ index, actualType: typeKeyword(answer), actualValue: answer });
  return answer;
}

const GroupByKeyNotKeywordError = declareShapeError('GroupByKeyNotKeywordError',
  ({ index, actualType }) => `groupBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`,
  { operand: 'groupBy', expectedType: 'keyword' }
);
const IndexByKeyNotKeywordError = declareShapeError('IndexByKeyNotKeywordError',
  ({ index, actualType }) => `indexBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`,
  { operand: 'indexBy', expectedType: 'keyword' }
);

// The slot that runs code per element takes a quote, and a value
// computed at the call is refused by the head at the site's place.
declareModifierError('FilterPredicateNotQuoteError', 'filter',  2, 'quote');
declareModifierError('EveryPredicateNotQuoteError',  'every',   2, 'quote');
declareModifierError('AnyPredicateNotQuoteError',    'any',     2, 'quote');
declareModifierError('GroupByKeyNotQuoteError',      'groupBy', 2, 'quote');
declareModifierError('IndexByKeyNotQuoteError',      'indexBy', 2, 'quote');
declareModifierError('SortKeyNotQuoteError',         'sort',    2, 'quote');
declareModifierError('ReduceReducerNotQuoteError',   'reduce',  3, 'quote');

// A count and an index are whole numbers: the head refuses a value of
// another kind at the site's place, and the primitive a fraction. A key
// of a map is the map's residence's own [D73].
const TakeCountNotIntegerError = declareModifierError('TakeCountNotIntegerError', 'take', 2, 'integer');
const DropCountNotIntegerError = declareModifierError('DropCountNotIntegerError', 'drop', 2, 'integer');
const AtIndexNotIntegerError   = declareModifierError('AtIndexNotIntegerError',   'at',   2, 'integer');
declareModifierError('AtKeyNotKeywordOrStringError', '::map/at', 2, ['keyword', 'string']);

function wholeOrRefuse(value, ErrorCls) {
  if (!Number.isInteger(value)) throw new ErrorCls(value);
  return value;
}

const SumElementNotNumberError = declareElementError('SumElementNotNumberError', 'sum', 'number');
// Every element is a finite double, yet their running total can
// still leave the range. `:index` names the element the total
// crossed at, so the subject can be split at that point.
const SumResultNotFiniteError = declareNumericDomainError('SumResultNotFiniteError',
  ({ index }) => `sum: the running total leaves the finite double range at element ${index}`,
  { operand: 'sum' }
);

const ReduceReducerNotBinaryError = declareShapeError('ReduceReducerNotBinaryError',
  () => 'reduce reducer must be a binary operand (add / mul / union / …) or a verb whose first slot takes the element',
  { operand: 'reduce' }
);

// The elements a container holds, a map's its values.
function elementsOf(container) {
  return isQMap(container) ? [...container.values()] : container;
}

function sizeOf(container) {
  return isQMap(container) ? container.size : container.length;
}

// The least or the greatest element in the one order, `pick` naming
// which side wins a comparison.
function extremeOf(container, pick) {
  const items = elementsOf(container);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    if (pick(compareValues(items[i], acc))) acc = items[i];
  }
  return acc;
}

bindPrim('count', container => sizeOf(container));
bindPrim('empty', container => sizeOf(container) === 0);

bindPrim('first', container => {
  const items = elementsOf(container);
  return items.length === 0 ? NULL : items[0];
});

bindPrim('last', container => {
  const items = elementsOf(container);
  return items.length === 0 ? NULL : items[items.length - 1];
});

bindPrim('sum', container => {
  const items = elementsOf(container);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') throw new SumElementNotNumberError(i, items[i]);
    total += items[i];
    if (!Number.isFinite(total)) throw new SumResultNotFiniteError({ index: i });
  }
  return total;
});

bindPrim('min', container => extremeOf(container, order => order < 0));
bindPrim('max', container => extremeOf(container, order => order > 0));

// `filter` keeps the entries of a map whose values pass, and the
// elements of a sequence that do; the head reads the answer back as the
// subject's own kind, a set through its constructor.
bindPrim('filter', async (container, predicate) => {
  const kept = [];
  for (const [index, entry] of [...(isQMap(container) ? container : container.entries())].entries()) {
    const verdict = await predicate(entry[1]);
    if (isErrorValue(verdict)) return verdict;
    if (booleanOf(verdict, index, FilterConditionNotBooleanError)) kept.push(entry);
  }
  return isQMap(container) ? new Map(kept) : kept.map(([, element]) => element);
});

bindPrim('every', async (container, predicate) => {
  for (const [index, element] of elementsOf(container).entries()) {
    const verdict = await predicate(element);
    if (isErrorValue(verdict)) return verdict;
    if (!booleanOf(verdict, index, EveryConditionNotBooleanError)) return false;
  }
  return true;
});

bindPrim('any', async (container, predicate) => {
  for (const [index, element] of elementsOf(container).entries()) {
    const verdict = await predicate(element);
    if (isErrorValue(verdict)) return verdict;
    if (booleanOf(verdict, index, AnyConditionNotBooleanError)) return true;
  }
  return false;
});

// The keyword the key of `groupBy` or `indexBy` answers for an element,
// or the error it answered.
async function keywordOf(key, element, index, ErrorCls) {
  const answer = await key(element);
  if (isErrorValue(answer) || isKeyword(answer)) return answer;
  throw new ErrorCls({ index, actualType: typeKeyword(answer), actualValue: answer });
}

// groupBy on a Set subject mints Set-typed buckets so the value-class
// signal of the original sequence (uniqueness) survives partitioning.
bindPrim('groupBy', async (sequence, key) => {
  const buckets = new Map();
  for (const [index, element] of sequence.entries()) {
    const bucketKey = await keywordOf(key, element, index, GroupByKeyNotKeywordError);
    if (isErrorValue(bucketKey)) return bucketKey;
    if (!buckets.has(bucketKey.name)) buckets.set(bucketKey.name, []);
    buckets.get(bucketKey.name).push(element);
  }
  if (isQSet(sequence)) {
    for (const [bucketName, bucketItems] of buckets) buckets.set(bucketName, makeSet(bucketItems));
  }
  return buckets;
});

bindPrim('indexBy', async (sequence, key) => {
  const index = new Map();
  for (const [position, element] of sequence.entries()) {
    const indexKey = await keywordOf(key, element, position, IndexByKeyNotKeywordError);
    if (isErrorValue(indexKey)) return indexKey;
    index.set(indexKey.name, element);
  }
  return index;
});

// `sort` orders the elements in the one order, or by the value the key
// answers for each, keeping equal ones in the subject's order; a map
// orders its entries by their values and keeps the keys.
bindPrim('sort', async (container, key) => {
  const entries = [...(isQMap(container) ? container : container.entries())];
  const keyed = [];
  for (const entry of entries) keyed.push({ entry, sortKey: key === NULL ? entry[1] : await key(entry[1]) });
  keyed.sort((left, right) => compareValues(left.sortKey, right.sortKey));
  const sorted = keyed.map(({ entry }) => entry);
  return isQMap(container) ? new Map(sorted) : sorted.map(([, element]) => element);
});

// A negative count clamps to 0, the same graceful out-of-range handling
// an over-length count gets (`take 99` → the whole container).
function sliceOf(container, start, end) {
  return isQMap(container) ? new Map([...container].slice(start, end)) : container.slice(start, end);
}

bindPrim('take', (container, count) => sliceOf(container, 0, Math.max(0, wholeOrRefuse(count, TakeCountNotIntegerError))));
bindPrim('drop', (container, count) => sliceOf(container, Math.max(0, wholeOrRefuse(count, DropCountNotIntegerError))));

// `at` — indexed access with Array.prototype.at-style negative indices
// on a sequence, a set indexing in its one order, and a soft lookup by
// a keyword or a string on a map; a miss answers null, where the strict
// `/key` projection refuses.
bindPrim('at', (container, place) => {
  if (isQMap(container)) {
    const lookupKey = isKeyword(place) ? place.name : place;
    return container.has(lookupKey) ? container.get(lookupKey) : NULL;
  }
  const index = wholeOrRefuse(place, AtIndexNotIntegerError);
  const resolvedIndex = index < 0 ? container.length + index : index;
  return (resolvedIndex >= 0 && resolvedIndex < container.length) ? container[resolvedIndex] : NULL;
});

// `distinct` is the constructor of the set [D16]: the elements of a
// vector in the one order without duplicates. A set passes through as
// it is.
bindPrim('distinct', sequence => (isQSet(sequence) ? sequence : makeSet(sequence)));

bindPrim('reverse', container => (isQMap(container) ? new Map([...container].reverse()) : [...container].reverse()));

// `flat` lifts one level of nesting: the inner sequences splice in
// order, and the head mints a set's answer as a set again, so a set of
// sets flattens into their union.
bindPrim('flat', sequence => sequence.flatMap(element => (isVec(element) ? element : [element])));

// `reduce seed ~(reducer)` — the universal left-fold: the reducer is
// applied as `reducer(acc, element)`, a binary operand through its bound
// form (`acc | add element`) and a verb with the element in its first
// slot [D67]; `seed` answers for an empty subject, and a reducer error
// stops the fold.
bindPrim('reduce', async (container, seed, reducer) => {
  const combine = resolveBinaryReducer(reducer);
  if (combine === null) throw new ReduceReducerNotBinaryError();
  let acc = seed;
  for (const element of elementsOf(container)) {
    acc = await combine(acc, element);
    if (isErrorValue(acc)) return acc;
  }
  return acc;
});

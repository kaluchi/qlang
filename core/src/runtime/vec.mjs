// Vec operands.
//
// Reducers (Vec → Scalar) are nullary on the subject. Transformers
// (Vec → Vec) are nullary or higher-order. `count` and `empty`
// are polymorphic over Vec/Set/Map — they answer "how many
// elements?" regardless of container shape.
//
// `filter` / `every` / `any` are container-universal item-select
// operands: the predicate fires against each element, a map's value
// being its element [D15], and `filter` keeps the keys of the entries
// it keeps. A conduit of one parameter binds the element; one of two
// or more has no axis to fill and raises the per-operand arity error.
//
// Every type check inlines its own `throw new X(...)` statement
// so the class name and source line uniquely identify the failing
// site.
//
// Meta lives in lib/qlang/operand/vec.qlang.

import { valueOp, higherOrderOp, nullaryOp, overloadedOp } from './dispatch.mjs';
import {
  isQSet, isKeyword, isTruthy, isErrorValue, typeKeyword, NULL,
  isVec, isQMap, makeSet
} from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import {
  declareSubjectError,
  declareModifierError,
  declareElementError
} from '../operand-errors.mjs';
import {
  declareShapeError,
  declareArityError,
  declareNumericDomainError
} from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import {
  resolveCapturedConduit,
  invokeConduitWithFixedArgs,
  resolveBinaryReducer,
  codeOfModifier,
  CONDUIT_PARAMS_FIELD
} from '../eval.mjs';

// A set is the vector in the one order without duplicates [D16], so
// every operand below reads it as a vector. The transformers that keep
// their subject's shape (filter / take / drop / flat / distinct) answer
// a vector and leave the tag to the dispatch wrapper's
// `applyTagPreservation`, which hands a set back to the constructor of
// `::set`; `sort` and `reverse` impose an order and answer a vector.

// ── Subject-type classes ───────────────────────────────────────

const CountSubjectNotContainerError    = declareSubjectError('CountSubjectNotContainerError',    'count',    ['vec', 'set', 'map']);
const EmptySubjectNotContainerError    = declareSubjectError('EmptySubjectNotContainerError',    'empty',    ['vec', 'set', 'map']);
const FirstSubjectNotSequenceError     = declareSubjectError('FirstSubjectNotSequenceError',     'first',    ['vec', 'set', 'map']);
const LastSubjectNotSequenceError      = declareSubjectError('LastSubjectNotSequenceError',      'last',     ['vec', 'set', 'map']);
const SumSubjectNotContainerError      = declareSubjectError('SumSubjectNotContainerError',      'sum',      ['vec', 'set', 'map']);
const MinSubjectNotContainerError      = declareSubjectError('MinSubjectNotContainerError',      'min',      ['vec', 'set', 'map']);
const MaxSubjectNotContainerError      = declareSubjectError('MaxSubjectNotContainerError',      'max',      ['vec', 'set', 'map']);
const FilterSubjectNotContainerError   = declareSubjectError('FilterSubjectNotContainerError',   'filter',   ['vec', 'set', 'map']);
const EverySubjectNotContainerError    = declareSubjectError('EverySubjectNotContainerError',    'every',    ['vec', 'set', 'map']);
const AnySubjectNotContainerError      = declareSubjectError('AnySubjectNotContainerError',      'any',      ['vec', 'set', 'map']);

// Per-operand arity-invalid classes — a predicate conduit reads the
// element, a map's value among them [D15]: 0 params read it as
// pipeValue, 1 param [:x] binds it as a named captured-arg, and two or
// more have no axis to fill.
const FilterPredArityInvalidError = declareArityError('FilterPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `filter requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`,
  { operand: 'filter' }
);
const EveryPredArityInvalidError  = declareArityError('EveryPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `every requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`,
  { operand: 'every' }
);
const AnyPredArityInvalidError    = declareArityError('AnyPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `any requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`,
  { operand: 'any' }
);
const GroupBySubjectNotSequenceError   = declareSubjectError('GroupBySubjectNotSequenceError',   'groupBy',  ['vec', 'set']);
const IndexBySubjectNotSequenceError   = declareSubjectError('IndexBySubjectNotSequenceError',   'indexBy',  ['vec', 'set']);
const GroupByKeyNotKeywordError        = declareShapeError('GroupByKeyNotKeywordError',
  ({ index, actualType }) => `groupBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`,
  { operand: 'groupBy', expectedType: 'keyword' }
);
const IndexByKeyNotKeywordError        = declareShapeError('IndexByKeyNotKeywordError',
  ({ index, actualType }) => `indexBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`,
  { operand: 'indexBy', expectedType: 'keyword' }
);
const SortNaturalSubjectNotSequenceError = declareSubjectError('SortNaturalSubjectNotSequenceError', 'sort',     ['vec', 'set', 'map']);
const SortByKeySubjectNotSequenceError   = declareSubjectError('SortByKeySubjectNotSequenceError',   'sort',     ['vec', 'set', 'map']);
const TakeSubjectNotSequenceError        = declareSubjectError('TakeSubjectNotSequenceError',        'take',     ['vec', 'set', 'map']);
const DropSubjectNotSequenceError        = declareSubjectError('DropSubjectNotSequenceError',        'drop',     ['vec', 'set', 'map']);
const DistinctSubjectNotSequenceError    = declareSubjectError('DistinctSubjectNotSequenceError',    'distinct', ['vec', 'set']);
const ReverseSubjectNotSequenceError     = declareSubjectError('ReverseSubjectNotSequenceError',     'reverse',  ['vec', 'set', 'map']);
const FlatSubjectNotSequenceError        = declareSubjectError('FlatSubjectNotSequenceError',        'flat',     ['vec', 'set']);

// The slot that runs code per element takes a quote, and a value
// computed at the call is refused at the site.
const FilterPredicateNotQuoteError      = declareModifierError('FilterPredicateNotQuoteError',      'filter',     2, 'quote');
const EveryPredicateNotQuoteError       = declareModifierError('EveryPredicateNotQuoteError',       'every',      2, 'quote');
const AnyPredicateNotQuoteError         = declareModifierError('AnyPredicateNotQuoteError',         'any',        2, 'quote');
const GroupByKeyNotQuoteError           = declareModifierError('GroupByKeyNotQuoteError',           'groupBy',    2, 'quote');
const IndexByKeyNotQuoteError           = declareModifierError('IndexByKeyNotQuoteError',           'indexBy',    2, 'quote');
const SortKeyNotQuoteError              = declareModifierError('SortKeyNotQuoteError',              'sort',       2, 'quote');
const ReduceReducerNotQuoteError        = declareModifierError('ReduceReducerNotQuoteError',        'reduce',     3, 'quote');

const TakeCountNotIntegerError = declareModifierError('TakeCountNotIntegerError', 'take', 2, 'integer');
const DropCountNotIntegerError = declareModifierError('DropCountNotIntegerError', 'drop', 2, 'integer');
const AtIndexNotIntegerError  = declareModifierError('AtIndexNotIntegerError', 'at',   2, 'integer');

// take / drop / at share one integer-modifier contract: the count or
// index must be a whole Number. Each site passes its own per-operand
// error class so the throw still names the operand uniquely. Negative
// handling diverges past this check — `at` reads from the tail, take /
// drop clamp to a 0-count — so the shared part is only the shape gate.
function assertIntegerModifier(value, ErrorCls) {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new ErrorCls(value);
}

const SumElementNotNumberError          = declareElementError('SumElementNotNumberError',          'sum',          'number');
// Every element is a finite double, yet their running total can
// still leave the range. `:index` names the element the total
// crossed at, so the subject can be split at that point.
const SumResultNotFiniteError = declareNumericDomainError('SumResultNotFiniteError',
  ({ index }) => `sum: the running total leaves the finite double range at element ${index}`,
  { operand: 'sum' }
);

// ── Polymorphic sizeOf for count/empty ─────────────────────────

function sizeOfContainer(container, ErrorCls) {
  if (isVec(container)) return container.length;
  if (isQMap(container)) return container.size;
  throw new ErrorCls(container);
}

// ── Vec → Scalar reducers ──────────────────────────────────────

export const count = nullaryOp('count', (container) =>
  sizeOfContainer(container, CountSubjectNotContainerError));

export const empty = nullaryOp('empty', (container) =>
  sizeOfContainer(container, EmptySubjectNotContainerError) === 0);

// sequenceOrThrow(container, ErrorCls) — the vector a sequence
// operand reads, a set among them in its one order.
function sequenceOrThrow(container, ErrorCls) {
  if (isVec(container)) return container;
  throw new ErrorCls(container);
}

// elementsOrThrow(container, ErrorCls) — the elements a value reducer
// reads: a sequence's own, and a map's values [D15].
function elementsOrThrow(container, ErrorCls) {
  if (isQMap(container)) return [...container.values()];
  return sequenceOrThrow(container, ErrorCls);
}

export const first = nullaryOp('first', (subject) => {
  const items = elementsOrThrow(subject, FirstSubjectNotSequenceError);
  return items.length === 0 ? NULL : items[0];
});

export const last = nullaryOp('last', (subject) => {
  const items = elementsOrThrow(subject, LastSubjectNotSequenceError);
  return items.length === 0 ? NULL : items[items.length - 1];
});

export const sum = nullaryOp('sum', (container) => {
  const items = elementsOrThrow(container, SumSubjectNotContainerError);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') {
      throw new SumElementNotNumberError(i, items[i]);
    }
    total += items[i];
    if (!Number.isFinite(total)) throw new SumResultNotFiniteError({ index: i });
  }
  return total;
});

export const min = nullaryOp('min', (container) => {
  const items = elementsOrThrow(container, MinSubjectNotContainerError);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    if (compareValues(items[i], acc) < 0) acc = items[i];
  }
  return acc;
});

export const max = nullaryOp('max', (container) => {
  const items = elementsOrThrow(container, MaxSubjectNotContainerError);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    if (compareValues(items[i], acc) > 0) acc = items[i];
  }
  return acc;
});

// ── Vec → Vec transformers ─────────────────────────────────────

// containerPredDispatch(predLambda, ArityErrorCls) — the per-element
// applier of filter / every / any, a map's value being its element
// [D15]. When the captured expression is a bare identifier resolving
// to a conduit, a conduit of one parameter [:x] binds the element and
// mirrors it as pipeValue, and one of two or more has no axis to fill
// and is refused once per subject; any other predicate runs with the
// element as pipeValue.
function containerPredDispatch(predLambda, ArityErrorCls) {
  const resolved = resolveCapturedConduit(predLambda.astNode, predLambda.capturedState.env);
  if (resolved) {
    const paramCount = resolved.conduit.get(CONDUIT_PARAMS_FIELD).length;
    if (paramCount === 1) {
      return async (item) =>
        await invokeConduitWithFixedArgs(resolved.conduit, resolved.lookupName, [item], item, predLambda.capturedState);
    }
    if (paramCount >= 2) {
      throw new ArityErrorCls({ conduitName: resolved.conduit.get('name'), actualArity: paramCount });
    }
  }
  return async (item) => await predLambda(item);
}

export const filter = higherOrderOp('filter', 2, async (container, predModifier) => {
  const predLambda = await codeOfModifier(predModifier, container, v => new FilterPredicateNotQuoteError(v));
  if (isVec(container)) {
    const applyItem = containerPredDispatch(predLambda, FilterPredArityInvalidError);
    const filterResult = [];
    for (const filterItem of container) {
      const predResult = await applyItem(filterItem);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.push(filterItem);
    }
    return filterResult;
  }
  if (isQMap(container)) {
    const applyValue = containerPredDispatch(predLambda, FilterPredArityInvalidError);
    const filterEntries = [];
    for (const [filterKey, filterValue] of container) {
      const predResult = await applyValue(filterValue);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterEntries.push([filterKey, filterValue]);
    }
    return new Map(filterEntries);
  }
  throw new FilterSubjectNotContainerError(container);
}, { preservesTag: true });

export const every = higherOrderOp('every', 2, async (container, everyPredModifier) => {
  const everyPredLambda = await codeOfModifier(everyPredModifier, container, v => new EveryPredicateNotQuoteError(v));
  if (isVec(container)) {
    const applyItem = containerPredDispatch(everyPredLambda, EveryPredArityInvalidError);
    for (const everyItem of container) {
      const everyResult = await applyItem(everyItem);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  if (isQMap(container)) {
    const applyValue = containerPredDispatch(everyPredLambda, EveryPredArityInvalidError);
    for (const everyValue of container.values()) {
      const everyResult = await applyValue(everyValue);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  throw new EverySubjectNotContainerError(container);
});

export const any = higherOrderOp('any', 2, async (container, anyPredModifier) => {
  const anyPredLambda = await codeOfModifier(anyPredModifier, container, v => new AnyPredicateNotQuoteError(v));
  if (isVec(container)) {
    const applyItem = containerPredDispatch(anyPredLambda, AnyPredArityInvalidError);
    for (const anyItem of container) {
      const anyResult = await applyItem(anyItem);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  if (isQMap(container)) {
    const applyValue = containerPredDispatch(anyPredLambda, AnyPredArityInvalidError);
    for (const anyValue of container.values()) {
      const anyResult = await applyValue(anyValue);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  throw new AnySubjectNotContainerError(container);
});

// groupBy on a Set subject mints Set-typed buckets so the value-class
// signal of the original sequence (uniqueness) survives partitioning.
// On a Vec subject the buckets are Vecs.
export const groupBy = higherOrderOp('groupBy', 2, async (subject, groupKeyModifier) => {
  const groupKeyLambda = await codeOfModifier(groupKeyModifier, subject, v => new GroupByKeyNotQuoteError(v));
  const items = sequenceOrThrow(subject, GroupBySubjectNotSequenceError);
  const groupResult = new Map();
  for (let gi = 0; gi < items.length; gi++) {
    const groupElem = items[gi];
    const groupKey = await groupKeyLambda(groupElem);
    if (isErrorValue(groupKey)) return groupKey;
    if (!isKeyword(groupKey)) {
      throw new GroupByKeyNotKeywordError({
        index: gi,
        actualType: typeKeyword(groupKey),
        actualValue: groupKey
      });
    }
    if (!groupResult.has(groupKey.name)) groupResult.set(groupKey.name, []);
    groupResult.get(groupKey.name).push(groupElem);
  }
  if (isQSet(subject)) {
    for (const [bucketKey, bucketItems] of groupResult) groupResult.set(bucketKey, makeSet(bucketItems));
  }
  return groupResult;
});

export const indexBy = higherOrderOp('indexBy', 2, async (subject, indexKeyModifier) => {
  const indexKeyLambda = await codeOfModifier(indexKeyModifier, subject, v => new IndexByKeyNotQuoteError(v));
  const items = sequenceOrThrow(subject, IndexBySubjectNotSequenceError);
  const indexResult = new Map();
  for (let ii = 0; ii < items.length; ii++) {
    const indexElem = items[ii];
    const indexKey = await indexKeyLambda(indexElem);
    if (isErrorValue(indexKey)) return indexKey;
    if (!isKeyword(indexKey)) {
      throw new IndexByKeyNotKeywordError({
        index: ii,
        actualType: typeKeyword(indexKey),
        actualValue: indexKey
      });
    }
    indexResult.set(indexKey.name, indexElem);
  }
  return indexResult;
});

export const sort = overloadedOp('sort', 2, {
  0: (subject) => {
    if (isQMap(subject)) return new Map([...subject].sort(([, leftValue], [, rightValue]) => compareValues(leftValue, rightValue)));
    return [...sequenceOrThrow(subject, SortNaturalSubjectNotSequenceError)].sort(compareValues);
  },
  1: async (subject, sortKeyModifier) => {
    const sortKeyLambda = await codeOfModifier(sortKeyModifier, subject, v => new SortKeyNotQuoteError(v));
    if (isQMap(subject)) {
      const keyedEntries = await Promise.all(
        [...subject].map(async ([entryKey, entryValue]) => ({ entryKey, entryValue, sortKey: await sortKeyLambda(entryValue) }))
      );
      keyedEntries.sort((a, b) => compareValues(a.sortKey, b.sortKey));
      return new Map(keyedEntries.map(entry => [entry.entryKey, entry.entryValue]));
    }
    const items = sequenceOrThrow(subject, SortByKeySubjectNotSequenceError);
    const sortEntries = await Promise.all(
      items.map(async (sortElem) => ({
        sortElem,
        sortKey: await sortKeyLambda(sortElem)
      }))
    );
    sortEntries.sort((a, b) => compareValues(a.sortKey, b.sortKey));
    return sortEntries.map(entry => entry.sortElem);
  }
}, { preservesTag: true, imposesOrder: true });

export const take = valueOp('take', 2, (subject, n) => {
  if (isQMap(subject)) {
    assertIntegerModifier(n, TakeCountNotIntegerError);
    return new Map([...subject].slice(0, Math.max(0, n)));
  }
  if (!isVec(subject)) throw new TakeSubjectNotSequenceError(subject);
  assertIntegerModifier(n, TakeCountNotIntegerError);
  // A negative count clamps to 0, the same graceful out-of-range
  // handling an over-length count gets (`take 99` → whole sequence).
  return subject.slice(0, Math.max(0, n));
}, { preservesTag: true });

// `at` — indexed access with Array.prototype.at-style negative indices.
// Out-of-bounds returns null, mirroring the Map-miss / Vec-miss symmetry
// of the projection operator. Non-integer Number subjects (e.g. `at 0.5`)
// raise a modifier-shape error because silent coercion would mask the
// caller's intent. `last` remains in the catalog as the idiomatic shorthand
// for `at -1`; the two are semantically identical. A set indexes as
// the vector it is — `myset | at 0` is its least element, the one
// `first` answers.
const AtSubjectNotSequenceOrMapError  = declareSubjectError('AtSubjectNotSequenceOrMapError', 'at', ['vec', 'set', 'map']);
const AtKeyNotKeywordOrStringError    = declareModifierError('AtKeyNotKeywordOrStringError',  'at', 2, ['keyword', 'string']);

// Map-shape branch is a soft lookup — no key-back-into-container
// roundtrip, so the captured-arg shape can be either Keyword or
// String over every Map-shape subject (both normalise to the
// storage-side String via `key.name`/identity, matching
// `Map.has` / `Map.get`). The `src | keys | first |
// as :k | src | at k` chain composes through either source
// without an inter-shape coercion.
export const at = valueOp('at', 2, (subject, atKey) => {
  if (isVec(subject)) {
    assertIntegerModifier(atKey, AtIndexNotIntegerError);
    const resolvedIndex = atKey < 0 ? subject.length + atKey : atKey;
    return (resolvedIndex >= 0 && resolvedIndex < subject.length) ? subject[resolvedIndex] : NULL;
  }
  if (isQMap(subject)) {
    let lookupKey;
    if (isKeyword(atKey)) lookupKey = atKey.name;
    else if (typeof atKey === 'string') lookupKey = atKey;
    else throw new AtKeyNotKeywordOrStringError(atKey);
    return subject.has(lookupKey) ? subject.get(lookupKey) : NULL;
  }
  throw new AtSubjectNotSequenceOrMapError(subject);
});

export const drop = valueOp('drop', 2, (subject, n) => {
  if (isQMap(subject)) {
    assertIntegerModifier(n, DropCountNotIntegerError);
    return new Map([...subject].slice(Math.max(0, n)));
  }
  if (!isVec(subject)) throw new DropSubjectNotSequenceError(subject);
  assertIntegerModifier(n, DropCountNotIntegerError);
  // A negative count clamps to 0 (drop nothing), mirroring take's
  // clamp and the over-length case (`drop 99` → empty sequence).
  return subject.slice(Math.max(0, n));
}, { preservesTag: true });

// `distinct` is the constructor of the set [D16]: the elements of a
// vector in the one order without duplicates, so downstream operands
// receive a value that announces «no duplicates» on the type plane. A
// set passes through as it is.
export const distinct = nullaryOp('distinct', (subject) => {
  if (!isVec(subject)) throw new DistinctSubjectNotSequenceError(subject);
  return isQSet(subject) ? subject : makeSet(subject);
}, { preservesTag: true });

export const reverse = nullaryOp('reverse', (subject) => {
  if (isQMap(subject)) return new Map([...subject].reverse());
  if (!isVec(subject)) throw new ReverseSubjectNotSequenceError(subject);
  return [...subject].reverse();
}, { preservesTag: true, imposesOrder: true });

// `flat` lifts one level of nesting: the inner sequences splice in
// order. Over a set the result goes back through the constructor of
// `::set`, so a set of sets flattens into their union.
export const flat = nullaryOp('flat', (subject) => {
  if (!isVec(subject)) throw new FlatSubjectNotSequenceError(subject);
  const result = [];
  for (const item of subject) {
    if (isVec(item)) result.push(...item);
    else result.push(item);
  }
  return result;
}, { preservesTag: true });

// `reduce seed ~(reducer)` — the universal left-fold. Threads the
// accumulator and applies `reducer(acc, element)` at each step: a
// binary operand folds via its bound form (`acc | add element`), a
// 2-param conduit `[:acc :elem]` binds both. `seed` is the
// empty-subject result; a reducer error short-circuits.
const ReduceSubjectNotSequenceError = declareSubjectError('ReduceSubjectNotSequenceError', 'reduce', ['vec', 'set', 'map']);
const ReduceReducerNotBinaryError = declareShapeError('ReduceReducerNotBinaryError',
  () => 'reduce reducer must be a binary operand (add / mul / union / …) or a 2-param conduit [:acc :elem]',
  { operand: 'reduce' }
);

export const reduce = higherOrderOp('reduce', 3, async (subject, seedLambda, reducerModifier) => {
  const reducerLambda = await codeOfModifier(reducerModifier, subject, v => new ReduceReducerNotQuoteError(v));
  if (!isVec(subject) && !isQMap(subject)) throw new ReduceSubjectNotSequenceError(subject);
  const combine = resolveBinaryReducer(reducerLambda.astNode, reducerLambda.capturedState);
  if (combine === null) throw new ReduceReducerNotBinaryError();
  let acc = await seedLambda(subject);
  if (isErrorValue(acc)) return acc;
  for (const item of isQMap(subject) ? subject.values() : subject) {
    acc = await combine(acc, item);
    if (isErrorValue(acc)) return acc;
  }
  return acc;
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('count',        count);
bindPrim('empty',        empty);
bindPrim('first',        first);
bindPrim('last',         last);
bindPrim('sum',          sum);
bindPrim('min',          min);
bindPrim('max',          max);
bindPrim('filter',       filter);
bindPrim('every',        every);
bindPrim('any',          any);
bindPrim('groupBy',      groupBy);
bindPrim('indexBy',      indexBy);
bindPrim('sort',         sort);
bindPrim('take',         take);
bindPrim('at',           at);
bindPrim('drop',         drop);
bindPrim('distinct',     distinct);
bindPrim('reverse',      reverse);
bindPrim('flat',         flat);
bindPrim('reduce',       reduce);

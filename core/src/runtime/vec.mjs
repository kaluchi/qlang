// Vec operands.
//
// Reducers (Vec → Scalar) are nullary on the subject. Transformers
// (Vec → Vec) are nullary or higher-order. `count` and `empty`
// are polymorphic over Vec/Set/Map — they answer "how many
// elements?" regardless of container shape.
//
// `filter` / `every` / `any` are container-universal item-select
// operands. On Vec and Set the predicate fires against each
// element. On Map the predicate dispatch reads the captured arg's
// arity:
//
//   0-arity pipeline (`filter(gt(1))`) or 1-arity conduit (`[:v]`)
//     → per entry with value as pipeValue; key is not visible.
//   2-arity conduit (`[:k :v]`)
//     → per entry with (key, value) as captured-arg values; pipeValue
//       is the value. Writing the predicate as a named let-conduit
//       is the idiom for both-axis filtering:
//
//         m
//           | let(:@hot, [:k :v], and(k | eq(:x), v | gt(1)))
//           | filter(@hot)
//
//   3+-arity → per-operand arity-error. The language does not
//     pair-encode keys/values into a single argument; higher arities
//     are not meaningful for entry iteration.
//
// Every type check inlines its own `throw new X(...)` statement
// so the class name and source line uniquely identify the failing
// site.
//
// Meta lives in lib/qlang/core.qlang.

import { valueOp, higherOrderOp, nullaryOp, overloadedOp } from './dispatch.mjs';
import {
  isVec, isQMap, isQSet, isKeyword, isTruthy, isErrorValue, describeType, NULL, keyword
} from '../types.mjs';
import {
  declareSubjectError,
  declareModifierError,
  declareElementError,
  declareComparabilityError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import {
  resolveCapturedConduit,
  invokeConduitWithFixedArgs,
  KW_CONDUIT_PARAMS
} from '../eval.mjs';

// ── Subject-type classes ───────────────────────────────────────

const CountSubjectNotContainer    = declareSubjectError('CountSubjectNotContainer',    'count',    'Vec, Set, or Map');
const EmptySubjectNotContainer    = declareSubjectError('EmptySubjectNotContainer',    'empty',    'Vec, Set, or Map');
const FirstSubjectNotVec          = declareSubjectError('FirstSubjectNotVec',          'first',    'Vec');
const LastSubjectNotVec           = declareSubjectError('LastSubjectNotVec',           'last',     'Vec');
const SumSubjectNotVecOrSet       = declareSubjectError('SumSubjectNotVecOrSet',       'sum',      'Vec or Set');
const MinSubjectNotVecOrSet       = declareSubjectError('MinSubjectNotVecOrSet',       'min',      'Vec or Set');
const MaxSubjectNotVecOrSet       = declareSubjectError('MaxSubjectNotVecOrSet',       'max',      'Vec or Set');
const FilterSubjectNotContainer   = declareSubjectError('FilterSubjectNotContainer',   'filter',   'Vec, Set, or Map');
const EverySubjectNotContainer    = declareSubjectError('EverySubjectNotContainer',    'every',    'Vec, Set, or Map');
const AnySubjectNotContainer      = declareSubjectError('AnySubjectNotContainer',      'any',      'Vec, Set, or Map');

// Per-operand arity-invalid classes — a conduit predicate passed to
// filter / every / any over a Map must declare 0, 1, or 2 parameters.
// Zero- and one-arity read value-as-pipeValue (the key is not visible);
// two-arity receives (key, value) as captured-arg values. Three or more
// parameters have no meaning for entry iteration.
const FilterMapPredArityInvalid = declareArityError('FilterMapPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `filter over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const EveryMapPredArityInvalid  = declareArityError('EveryMapPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `every over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const AnyMapPredArityInvalid    = declareArityError('AnyMapPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `any over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const GroupBySubjectNotVec        = declareSubjectError('GroupBySubjectNotVec',        'groupBy',  'Vec');
const IndexBySubjectNotVec        = declareSubjectError('IndexBySubjectNotVec',        'indexBy',  'Vec');
const GroupByKeyNotKeyword        = declareShapeError('GroupByKeyNotKeyword',
  ({ index, actualType }) => `groupBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType}`);
const IndexByKeyNotKeyword        = declareShapeError('IndexByKeyNotKeyword',
  ({ index, actualType }) => `indexBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType}`);
const SortNaturalSubjectNotVec    = declareSubjectError('SortNaturalSubjectNotVec',    'sort',     'Vec');
const SortByKeySubjectNotVec      = declareSubjectError('SortByKeySubjectNotVec',      'sort',     'Vec');
const SortWithSubjectNotVec       = declareSubjectError('SortWithSubjectNotVec',       'sortWith', 'Vec');
const FirstNonZeroSubjectNotVec   = declareSubjectError('FirstNonZeroSubjectNotVec',   'firstNonZero', 'Vec of Numbers');
const TakeSubjectNotVec           = declareSubjectError('TakeSubjectNotVec',           'take',     'Vec');
const DropSubjectNotVec           = declareSubjectError('DropSubjectNotVec',           'drop',     'Vec');
const DistinctSubjectNotVec       = declareSubjectError('DistinctSubjectNotVec',       'distinct', 'Vec');
const ReverseSubjectNotVec        = declareSubjectError('ReverseSubjectNotVec',        'reverse',  'Vec');
const FlatSubjectNotVec           = declareSubjectError('FlatSubjectNotVec',           'flat',     'Vec');

const TakeCountNotNumber = declareModifierError('TakeCountNotNumber', 'take', 2, 'Number');
const DropCountNotNumber = declareModifierError('DropCountNotNumber', 'drop', 2, 'Number');
const AtSubjectNotVec    = declareSubjectError('AtSubjectNotVec',    'at',   'Vec');
const AtIndexNotInteger  = declareModifierError('AtIndexNotInteger', 'at',   2, 'Integer');

const SumElementNotNumber          = declareElementError('SumElementNotNumber',          'sum',          'Number');
const FirstNonZeroElementNotNumber = declareElementError('FirstNonZeroElementNotNumber', 'firstNonZero', 'Number');

const MinElementsNotComparable    = declareComparabilityError('MinElementsNotComparable',    'min');
const MaxElementsNotComparable    = declareComparabilityError('MaxElementsNotComparable',    'max');
const SortNaturalNotComparable    = declareComparabilityError('SortNaturalNotComparable',    'sort');
const SortByKeyNotComparable      = declareComparabilityError('SortByKeyNotComparable',      'sort(key)');
const AscKeysNotComparable        = declareComparabilityError('AscKeysNotComparable',        'asc');
const DescKeysNotComparable       = declareComparabilityError('DescKeysNotComparable',       'desc');
const NullsFirstKeysNotComparable = declareComparabilityError('NullsFirstKeysNotComparable', 'nullsFirst');
const NullsLastKeysNotComparable  = declareComparabilityError('NullsLastKeysNotComparable',  'nullsLast');

const SortWithCmpResultNotNumber = declareShapeError('SortWithCmpResultNotNumber',
  ({ actualType }) => `sortWith comparator must return a Number, got ${actualType}`);
const AscPairNotMap = declareShapeError('AscPairNotMap',
  ({ actualType }) => `asc requires a pair Map subject ({ :left x :right y }), got ${actualType}`);
const DescPairNotMap = declareShapeError('DescPairNotMap',
  ({ actualType }) => `desc requires a pair Map subject ({ :left x :right y }), got ${actualType}`);
const NullsFirstPairNotMap = declareShapeError('NullsFirstPairNotMap',
  ({ actualType }) => `nullsFirst requires a pair Map subject ({ :left x :right y }), got ${actualType}`);
const NullsLastPairNotMap = declareShapeError('NullsLastPairNotMap',
  ({ actualType }) => `nullsLast requires a pair Map subject ({ :left x :right y }), got ${actualType}`);

// ── Polymorphic sizeOf for count/empty ─────────────────────────

function sizeOfContainer(container, ErrorCls) {
  if (isVec(container))  return container.length;
  if (isQSet(container)) return container.size;
  if (isQMap(container)) return container.size;
  throw new ErrorCls(describeType(container), container);
}

// ── Vec → Scalar reducers ──────────────────────────────────────

export const count = nullaryOp('count', (container) =>
  sizeOfContainer(container, CountSubjectNotContainer));

export const empty = nullaryOp('empty', (container) =>
  sizeOfContainer(container, EmptySubjectNotContainer) === 0);

// vecOrSetElements(container, ErrorCls) — returns an array view of a
// Vec-or-Set subject. Vec yields itself; Set spreads to an array. The
// order of the returned array is NOT part of qlang's public contract
// on Set (the spec declares Set as unordered), so only commutative /
// order-independent reducers are allowed to dispatch through this
// helper — sum, min, max. Order-dependent operands (first, last, at,
// firstNonZero, sort, reverse, take, drop, distinct, flat) stay
// Vec-only.
function vecOrSetElements(container, ErrorCls) {
  if (isVec(container))  return container;
  if (isQSet(container)) return [...container];
  throw new ErrorCls(describeType(container), container);
}

export const first = nullaryOp('first', (vec) => {
  if (!isVec(vec)) throw new FirstSubjectNotVec(describeType(vec), vec);
  return vec.length === 0 ? NULL : vec[0];
});

export const last = nullaryOp('last', (vec) => {
  if (!isVec(vec)) throw new LastSubjectNotVec(describeType(vec), vec);
  return vec.length === 0 ? NULL : vec[vec.length - 1];
});

export const sum = nullaryOp('sum', (container) => {
  const items = vecOrSetElements(container, SumSubjectNotVecOrSet);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') {
      throw new SumElementNotNumber(i, describeType(items[i]), items[i]);
    }
    total += items[i];
  }
  return total;
});

export const min = nullaryOp('min', (container) => {
  const items = vecOrSetElements(container, MinSubjectNotVecOrSet);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    checkComparable(MinElementsNotComparable, acc, items[i]);
    if (items[i] < acc) acc = items[i];
  }
  return acc;
});

export const max = nullaryOp('max', (container) => {
  const items = vecOrSetElements(container, MaxSubjectNotVecOrSet);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    checkComparable(MaxElementsNotComparable, acc, items[i]);
    if (items[i] > acc) acc = items[i];
  }
  return acc;
});

function checkComparable(ErrorCls, left, right) {
  const leftType = describeType(left);
  const rightType = describeType(right);
  const isScalar = (t) => t === 'Number' || t === 'String';
  if (!isScalar(leftType) || !isScalar(rightType) || leftType !== rightType) {
    throw new ErrorCls(leftType, rightType);
  }
}

// ── Vec → Vec transformers ─────────────────────────────────────

// mapPredDispatch(predLambda, ArityErrorCls) — resolves a captured-arg
// predicate for filter/every/any over a Map. Returns a per-entry
// applier that takes (k, v) and produces the boolean-ish predicate
// result. Three dispatch paths:
//
//   • captured arg is a bare identifier resolving to a 2-arity conduit
//     → per-entry invocation with (k, v) as captured-arg values; the
//       body's pipeValue is the value (consistent with the 0/1-arity
//       path below, so any body that references pipeValue sees the
//       entry's value regardless of param count).
//
//   • captured arg is a bare identifier resolving to a conduit with
//     3+ params → throws the operand-specific ArityErrorCls eagerly
//     (one throw per container subject — not per entry — because the
//     arity is static).
//
//   • any other shape (0-arity pipeline, 1-arity conduit, inline
//     expression) → per-entry application with value as pipeValue.
//     This path goes through the standard predLambda(value) call so
//     errors inside the predicate propagate identically to the Vec
//     and Set branches.
function mapPredDispatch(predLambda, ArityErrorCls) {
  const resolved = resolveCapturedConduit(predLambda.astNode, predLambda.capturedEnv);
  if (resolved) {
    const paramCount = resolved.conduit.get(KW_CONDUIT_PARAMS).length;
    if (paramCount === 2) {
      return async (mapKey, mapValue) =>
        await invokeConduitWithFixedArgs(resolved.conduit, resolved.lookupName, [mapKey, mapValue], mapValue);
    }
    if (paramCount > 2) {
      throw new ArityErrorCls({
        conduitName: resolved.conduit.get(keyword('name')),
        actualArity: paramCount
      });
    }
  }
  return async (_mapKey, mapValue) => await predLambda(mapValue);
}

export const filter = higherOrderOp('filter', 2, async (container, predLambda) => {
  if (isVec(container)) {
    const filterResult = [];
    for (const filterItem of container) {
      const predResult = await predLambda(filterItem);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.push(filterItem);
    }
    return filterResult;
  }
  if (isQSet(container)) {
    const filterResult = new Set();
    for (const filterItem of container) {
      const predResult = await predLambda(filterItem);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.add(filterItem);
    }
    return filterResult;
  }
  if (isQMap(container)) {
    const applyEntry = mapPredDispatch(predLambda, FilterMapPredArityInvalid);
    const filterResult = new Map();
    for (const [filterKey, filterValue] of container) {
      const predResult = await applyEntry(filterKey, filterValue);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.set(filterKey, filterValue);
    }
    return filterResult;
  }
  throw new FilterSubjectNotContainer(describeType(container), container);
});

export const every = higherOrderOp('every', 2, async (container, everyPredLambda) => {
  if (isVec(container) || isQSet(container)) {
    for (const everyItem of container) {
      const everyResult = await everyPredLambda(everyItem);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  if (isQMap(container)) {
    const applyEntry = mapPredDispatch(everyPredLambda, EveryMapPredArityInvalid);
    for (const [everyKey, everyValue] of container) {
      const everyResult = await applyEntry(everyKey, everyValue);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  throw new EverySubjectNotContainer(describeType(container), container);
});

export const any = higherOrderOp('any', 2, async (container, anyPredLambda) => {
  if (isVec(container) || isQSet(container)) {
    for (const anyItem of container) {
      const anyResult = await anyPredLambda(anyItem);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  if (isQMap(container)) {
    const applyEntry = mapPredDispatch(anyPredLambda, AnyMapPredArityInvalid);
    for (const [anyKey, anyValue] of container) {
      const anyResult = await applyEntry(anyKey, anyValue);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  throw new AnySubjectNotContainer(describeType(container), container);
});

export const groupBy = higherOrderOp('groupBy', 2, async (vec, groupKeyLambda) => {
  if (!isVec(vec)) throw new GroupBySubjectNotVec(describeType(vec), vec);
  const groupResult = new Map();
  for (let gi = 0; gi < vec.length; gi++) {
    const groupElem = vec[gi];
    const groupKey = await groupKeyLambda(groupElem);
    if (isErrorValue(groupKey)) return groupKey;
    if (!isKeyword(groupKey)) {
      throw new GroupByKeyNotKeyword({
        index: gi,
        actualType: describeType(groupKey),
        actualValue: groupKey
      });
    }
    if (!groupResult.has(groupKey)) groupResult.set(groupKey, []);
    groupResult.get(groupKey).push(groupElem);
  }
  return groupResult;
});

export const indexBy = higherOrderOp('indexBy', 2, async (vec, indexKeyLambda) => {
  if (!isVec(vec)) throw new IndexBySubjectNotVec(describeType(vec), vec);
  const indexResult = new Map();
  for (let ii = 0; ii < vec.length; ii++) {
    const indexElem = vec[ii];
    const indexKey = await indexKeyLambda(indexElem);
    if (isErrorValue(indexKey)) return indexKey;
    if (!isKeyword(indexKey)) {
      throw new IndexByKeyNotKeyword({
        index: ii,
        actualType: describeType(indexKey),
        actualValue: indexKey
      });
    }
    indexResult.set(indexKey, indexElem);
  }
  return indexResult;
});

export const sort = overloadedOp('sort', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new SortNaturalSubjectNotVec(describeType(vec), vec);
    return [...vec].sort((a, b) => {
      checkComparable(SortNaturalNotComparable, a, b);
      return compareScalars(a, b);
    });
  },
  1: async (vec, sortKeyLambda) => {
    if (!isVec(vec)) throw new SortByKeySubjectNotVec(describeType(vec), vec);
    // Pre-compute all keys (async) then sort synchronously by cached keys.
    const sortEntries = await Promise.all(
      vec.map(async (sortElem) => ({
        sortElem,
        sortKey: await sortKeyLambda(sortElem)
      }))
    );
    sortEntries.sort((a, b) => {
      checkComparable(SortByKeyNotComparable, a.sortKey, b.sortKey);
      return compareScalars(a.sortKey, b.sortKey);
    });
    return sortEntries.map(entry => entry.sortElem);
  }
});

function compareScalars(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const take = valueOp('take', 2, (vec, n) => {
  if (!isVec(vec)) throw new TakeSubjectNotVec(describeType(vec), vec);
  if (typeof n !== 'number') throw new TakeCountNotNumber(describeType(n), n);
  return vec.slice(0, n);
});

// `at` — indexed access with Array.prototype.at-style negative indices.
// Out-of-bounds returns null, mirroring the Map-miss / Vec-miss symmetry
// of the projection operator. Non-integer Number subjects (e.g. `at(0.5)`)
// raise a modifier-shape error because silent coercion would mask the
// caller's intent. `last` remains in the catalog as the idiomatic shorthand
// for `at(-1)`; the two are semantically identical.
export const at = valueOp('at', 2, (vec, atIndex) => {
  if (!isVec(vec)) throw new AtSubjectNotVec(describeType(vec), vec);
  if (typeof atIndex !== 'number' || !Number.isInteger(atIndex)) {
    throw new AtIndexNotInteger(describeType(atIndex), atIndex);
  }
  const resolvedIndex = atIndex < 0 ? vec.length + atIndex : atIndex;
  return (resolvedIndex >= 0 && resolvedIndex < vec.length) ? vec[resolvedIndex] : NULL;
});

export const drop = valueOp('drop', 2, (vec, n) => {
  if (!isVec(vec)) throw new DropSubjectNotVec(describeType(vec), vec);
  if (typeof n !== 'number') throw new DropCountNotNumber(describeType(n), n);
  return vec.slice(n);
});

export const distinct = nullaryOp('distinct', (vec) => {
  if (!isVec(vec)) throw new DistinctSubjectNotVec(describeType(vec), vec);
  const seen = new Set();
  const result = [];
  for (const v of vec) {
    if (!seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }
  return result;
});

export const reverse = nullaryOp('reverse', (vec) => {
  if (!isVec(vec)) throw new ReverseSubjectNotVec(describeType(vec), vec);
  return [...vec].reverse();
});

export const flat = nullaryOp('flat', (vec) => {
  if (!isVec(vec)) throw new FlatSubjectNotVec(describeType(vec), vec);
  const result = [];
  for (const item of vec) {
    if (isVec(item)) result.push(...item);
    else result.push(item);
  }
  return result;
});

// ── sortWith and comparator builders ──────────────────────────

export const sortWith = higherOrderOp('sortWith', 2, async (vec, cmpLambda) => {
  if (!isVec(vec)) throw new SortWithSubjectNotVec(describeType(vec), vec);
  // Array.sort is synchronous; we precompute all pairwise comparisons
  // would be complex. Instead, use an async-compatible merge sort approach:
  // precompute comparison matrix or use a simple insertion sort with awaits.
  // Pragmatic approach: use a comparison cache with indices.
  const sortWithArr = [...vec];
  const sortWithLen = sortWithArr.length;
  // Insertion sort with async comparator — O(n²) but correct with async.
  for (let outerIdx = 1; outerIdx < sortWithLen; outerIdx++) {
    const sortWithCurrent = sortWithArr[outerIdx];
    let insertIdx = outerIdx - 1;
    while (insertIdx >= 0) {
      const cmpPair = new Map();
      cmpPair.set(keyword('left'), sortWithArr[insertIdx]);
      cmpPair.set(keyword('right'), sortWithCurrent);
      const cmpResult = await cmpLambda(cmpPair);
      if (typeof cmpResult !== 'number') {
        throw new SortWithCmpResultNotNumber({
          actualType: describeType(cmpResult),
          actualValue: cmpResult
        });
      }
      if (cmpResult <= 0) break;
      sortWithArr[insertIdx + 1] = sortWithArr[insertIdx];
      insertIdx--;
    }
    sortWithArr[insertIdx + 1] = sortWithCurrent;
  }
  return sortWithArr;
});

export const asc = higherOrderOp('asc', 2, async (pair, ascKeyLambda) => {
  if (!isQMap(pair)) throw new AscPairNotMap({
    actualType: describeType(pair), actualValue: pair
  });
  const ascLeft  = pair.get(keyword('left'));
  const ascRight = pair.get(keyword('right'));
  const ascLeftKey  = await ascKeyLambda(ascLeft);
  const ascRightKey = await ascKeyLambda(ascRight);
  checkComparable(AscKeysNotComparable, ascLeftKey, ascRightKey);
  return compareScalars(ascLeftKey, ascRightKey);
});

export const desc = higherOrderOp('desc', 2, async (pair, descKeyLambda) => {
  if (!isQMap(pair)) throw new DescPairNotMap({
    actualType: describeType(pair), actualValue: pair
  });
  const descLeft  = pair.get(keyword('left'));
  const descRight = pair.get(keyword('right'));
  const descLeftKey  = await descKeyLambda(descLeft);
  const descRightKey = await descKeyLambda(descRight);
  checkComparable(DescKeysNotComparable, descLeftKey, descRightKey);
  return -compareScalars(descLeftKey, descRightKey);
});

async function nullsKeyComparator(pair, nullsKeyLambda, nullFirst, PairNotMapError, KeysNotComparableError) {
  if (!isQMap(pair)) throw new PairNotMapError({ actualType: describeType(pair), actualValue: pair });
  const nullsLeft  = pair.get(keyword('left'));
  const nullsRight = pair.get(keyword('right'));
  const nullsLeftKey  = await nullsKeyLambda(nullsLeft);
  const nullsRightKey = await nullsKeyLambda(nullsRight);
  const leftIsNull  = nullsLeftKey === null || nullsLeftKey === undefined;
  const rightIsNull = nullsRightKey === null || nullsRightKey === undefined;
  if (leftIsNull && rightIsNull) return 0;
  if (leftIsNull) return nullFirst ? -1 : 1;
  if (rightIsNull) return nullFirst ? 1 : -1;
  checkComparable(KeysNotComparableError, nullsLeftKey, nullsRightKey);
  return compareScalars(nullsLeftKey, nullsRightKey);
}

export const nullsFirst = higherOrderOp('nullsFirst', 2, async (pair, nullsFirstKeyLambda) =>
  await nullsKeyComparator(pair, nullsFirstKeyLambda, true, NullsFirstPairNotMap, NullsFirstKeysNotComparable));

export const nullsLast = higherOrderOp('nullsLast', 2, async (pair, nullsLastKeyLambda) =>
  await nullsKeyComparator(pair, nullsLastKeyLambda, false, NullsLastPairNotMap, NullsLastKeysNotComparable));

export const firstNonZero = nullaryOp('firstNonZero', (vec) => {
  if (!isVec(vec)) throw new FirstNonZeroSubjectNotVec(describeType(vec), vec);
  for (let i = 0; i < vec.length; i++) {
    if (typeof vec[i] !== 'number') {
      throw new FirstNonZeroElementNotNumber(i, describeType(vec[i]), vec[i]);
    }
    if (vec[i] !== 0) return vec[i];
  }
  return 0;
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/count'),        count);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/empty'),        empty);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/first'),        first);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/last'),         last);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/sum'),          sum);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/min'),          min);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/max'),          max);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/filter'),       filter);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/every'),        every);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/any'),          any);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/groupBy'),      groupBy);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/indexBy'),      indexBy);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/sort'),         sort);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/take'),         take);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/at'),           at);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/drop'),         drop);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/distinct'),     distinct);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/reverse'),      reverse);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/flat'),         flat);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/sortWith'),     sortWith);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/asc'),          asc);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/desc'),         desc);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/nullsFirst'),   nullsFirst);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/nullsLast'),    nullsLast);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/firstNonZero'), firstNonZero);

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
//       is the value. Writing the predicate as a named conduit
//       binding is the idiom for both-axis filtering:
//
//         m
//           | :@hot [:k :v] and(k | eq(:x), v | gt(1))
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
  isQMap, isQSet, isKeyword, isTruthy, isErrorValue, typeKeyword, NULL, keyword,
  isVecShape, isMapShape, mapShapeEntries, mapShapeSize, mapShapeGet, mapShapeHas,
  vecLikeOf, mapLikeOf
} from '../types.mjs';
import { deepEqual } from '../equality.mjs';
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
  CONDUIT_PARAMS_FIELD
} from '../eval.mjs';

// ── Subject-type classes ───────────────────────────────────────

const CountSubjectNotContainer    = declareSubjectError('CountSubjectNotContainer',    'count',    ['vec', 'set', 'map']);
const EmptySubjectNotContainer    = declareSubjectError('EmptySubjectNotContainer',    'empty',    ['vec', 'set', 'map']);
const FirstSubjectNotVec          = declareSubjectError('FirstSubjectNotVec',          'first',    'vec');
const LastSubjectNotVec           = declareSubjectError('LastSubjectNotVec',           'last',     'vec');
const SumSubjectNotVecOrSet       = declareSubjectError('SumSubjectNotVecOrSet',       'sum',      ['vec', 'set']);
const MinSubjectNotVecOrSet       = declareSubjectError('MinSubjectNotVecOrSet',       'min',      ['vec', 'set']);
const MaxSubjectNotVecOrSet       = declareSubjectError('MaxSubjectNotVecOrSet',       'max',      ['vec', 'set']);
const FilterSubjectNotContainer   = declareSubjectError('FilterSubjectNotContainer',   'filter',   ['vec', 'set', 'map']);
const EverySubjectNotContainer    = declareSubjectError('EverySubjectNotContainer',    'every',    ['vec', 'set', 'map']);
const AnySubjectNotContainer      = declareSubjectError('AnySubjectNotContainer',      'any',      ['vec', 'set', 'map']);

// Per-operand arity-invalid classes — predicate conduit arity limits
// at each filter/every/any call site. On Vec or Set the predicate has
// one axis: 0 params read element-as-pipeValue, 1 param [:x] binds the
// element as a named captured-arg. Two or more params on Vec/Set have
// no axis to fill → per-operand *VecOrSetPredArityInvalid. On Map the
// predicate has two axes: 0/1 read value; 2 params [:k :v] bind both.
// Three or more on Map → per-operand *MapPredArityInvalid.
const FilterVecOrSetPredArityInvalid = declareArityError('FilterVecOrSetPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `filter over Vec or Set requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`);
const EveryVecOrSetPredArityInvalid  = declareArityError('EveryVecOrSetPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `every over Vec or Set requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`);
const AnyVecOrSetPredArityInvalid    = declareArityError('AnyVecOrSetPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `any over Vec or Set requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`);
const FilterMapPredArityInvalid = declareArityError('FilterMapPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `filter over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const EveryMapPredArityInvalid  = declareArityError('EveryMapPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `every over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const AnyMapPredArityInvalid    = declareArityError('AnyMapPredArityInvalid',
  ({ conduitName, actualArity }) =>
    `any over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const GroupBySubjectNotVec        = declareSubjectError('GroupBySubjectNotVec',        'groupBy',  'vec');
const IndexBySubjectNotVec        = declareSubjectError('IndexBySubjectNotVec',        'indexBy',  'vec');
const GroupByKeyNotKeyword        = declareShapeError('GroupByKeyNotKeyword',
  ({ index, actualType }) => `groupBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`);
const IndexByKeyNotKeyword        = declareShapeError('IndexByKeyNotKeyword',
  ({ index, actualType }) => `indexBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`);
const SortNaturalSubjectNotVec    = declareSubjectError('SortNaturalSubjectNotVec',    'sort',     'vec');
const SortByKeySubjectNotVec      = declareSubjectError('SortByKeySubjectNotVec',      'sort',     'vec');
const SortWithSubjectNotVec       = declareSubjectError('SortWithSubjectNotVec',       'sortWith', 'vec');
const FirstNonZeroSubjectNotVec   = declareSubjectError('FirstNonZeroSubjectNotVec',   'firstNonZero', 'vec');
const TakeSubjectNotVec           = declareSubjectError('TakeSubjectNotVec',           'take',     'vec');
const DropSubjectNotVec           = declareSubjectError('DropSubjectNotVec',           'drop',     'vec');
const DistinctSubjectNotVec       = declareSubjectError('DistinctSubjectNotVec',       'distinct', 'vec');
const ReverseSubjectNotVec        = declareSubjectError('ReverseSubjectNotVec',        'reverse',  'vec');
const FlatSubjectNotVec           = declareSubjectError('FlatSubjectNotVec',           'flat',     'vec');

const TakeCountNotNumber = declareModifierError('TakeCountNotNumber', 'take', 2, 'number');
const DropCountNotNumber = declareModifierError('DropCountNotNumber', 'drop', 2, 'number');
const AtIndexNotInteger  = declareModifierError('AtIndexNotInteger', 'at',   2, 'integer');

const SumElementNotNumber          = declareElementError('SumElementNotNumber',          'sum',          'number');
const FirstNonZeroElementNotNumber = declareElementError('FirstNonZeroElementNotNumber', 'firstNonZero', 'number');

const MinElementsNotComparable    = declareComparabilityError('MinElementsNotComparable',    'min');
const MaxElementsNotComparable    = declareComparabilityError('MaxElementsNotComparable',    'max');
const SortNaturalNotComparable    = declareComparabilityError('SortNaturalNotComparable',    'sort');
const SortByKeyNotComparable      = declareComparabilityError('SortByKeyNotComparable',      'sort(key)');
const AscKeysNotComparable        = declareComparabilityError('AscKeysNotComparable',        'asc');
const DescKeysNotComparable       = declareComparabilityError('DescKeysNotComparable',       'desc');
const NullsFirstKeysNotComparable = declareComparabilityError('NullsFirstKeysNotComparable', 'nullsFirst');
const NullsLastKeysNotComparable  = declareComparabilityError('NullsLastKeysNotComparable',  'nullsLast');

const SortWithCmpResultNotNumber = declareShapeError('SortWithCmpResultNotNumber',
  ({ actualType }) => `sortWith comparator must return a Number, got ${actualType.name}`);
const AscPairNotMap = declareShapeError('AscPairNotMap',
  ({ actualType }) => `asc requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);
const DescPairNotMap = declareShapeError('DescPairNotMap',
  ({ actualType }) => `desc requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);
const NullsFirstPairNotMap = declareShapeError('NullsFirstPairNotMap',
  ({ actualType }) => `nullsFirst requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);
const NullsLastPairNotMap = declareShapeError('NullsLastPairNotMap',
  ({ actualType }) => `nullsLast requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);

// ── Polymorphic sizeOf for count/empty ─────────────────────────

function sizeOfContainer(container, ErrorCls) {
  if (isVecShape(container)) return container.length;
  if (isQSet(container))     return container.size;
  if (isMapShape(container)) return mapShapeSize(container);
  throw new ErrorCls(container);
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
  if (isVecShape(container)) return container;
  if (isQSet(container))     return [...container];
  throw new ErrorCls(container);
}

export const first = nullaryOp('first', (vec) => {
  if (!isVecShape(vec)) throw new FirstSubjectNotVec(vec);
  return vec.length === 0 ? NULL : vec[0];
});

export const last = nullaryOp('last', (vec) => {
  if (!isVecShape(vec)) throw new LastSubjectNotVec(vec);
  return vec.length === 0 ? NULL : vec[vec.length - 1];
});

export const sum = nullaryOp('sum', (container) => {
  const items = vecOrSetElements(container, SumSubjectNotVecOrSet);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') {
      throw new SumElementNotNumber(i, items[i]);
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
  const bothNumbers = typeof left === 'number' && typeof right === 'number';
  const bothStrings = typeof left === 'string' && typeof right === 'string';
  if (!bothNumbers && !bothStrings) {
    throw new ErrorCls(left, right);
  }
}

// ── Vec → Vec transformers ─────────────────────────────────────

// containerPredDispatch(predLambda, shape, VecOrSetArityErrorCls,
//                       MapArityErrorCls) — resolves the captured-arg
// predicate for filter/every/any and returns a per-item applier. The
// applier signature depends on `shape`:
//
//   • 'single' (Vec/Set)  → (item) → predResult
//   • 'pair'   (Map)      → (key, value) → predResult
//
// When the captured expression is a bare identifier resolving to a
// conduit, the conduit's `:params` arity picks the dispatch:
//
//   arity 0                 — default predLambda path (inline pipeline
//                             or 0-arity conduit; pipeValue is the
//                             element on Vec/Set, the value on Map).
//   arity 1 [:x]            — the element (Vec/Set) or value (Map) is
//                             bound as the single captured-arg of the
//                             conduit body. Allowed on all three
//                             shapes; pipeValue mirrors the captured
//                             value so references to pipeValue inside
//                             the body stay aligned with the element
//                             / value axis.
//   arity 2 [:k :v]         — bound as (key, value). Only meaningful
//                             on Map (shape = 'pair'); on Vec/Set one
//                             axis exists and the second param has
//                             nothing to fill → VecOrSetArityErrorCls.
//   arity 3+                — per-shape arity-invalid class. Throws
//                             VecOrSetArityErrorCls on 'single' and
//                             MapArityErrorCls on 'pair'.
//
// The arity check fires once per container subject (not per entry)
// because `:params.length` is static — the dispatch rejects up front
// rather than producing a generic ConduitArityMismatch per item.
function containerPredDispatch(predLambda, shape, VecOrSetArityErrorCls, MapArityErrorCls) {
  const resolved = resolveCapturedConduit(predLambda.astNode, predLambda.capturedEnv);
  if (resolved) {
    const paramCount = resolved.conduit.get(CONDUIT_PARAMS_FIELD).length;
    const conduitName = resolved.conduit.get('name');
    if (paramCount === 1) {
      if (shape === 'pair') {
        return async (_mapKey, mapValue) =>
          await invokeConduitWithFixedArgs(resolved.conduit, resolved.lookupName, [mapValue], mapValue);
      }
      return async (item) =>
        await invokeConduitWithFixedArgs(resolved.conduit, resolved.lookupName, [item], item);
    }
    if (paramCount === 2) {
      if (shape === 'pair') {
        return async (mapKey, mapValue) =>
          await invokeConduitWithFixedArgs(resolved.conduit, resolved.lookupName, [keyword(mapKey), mapValue], mapValue);
      }
      throw new VecOrSetArityErrorCls({ conduitName, actualArity: paramCount });
    }
    if (paramCount >= 3) {
      const ArityErrorCls = shape === 'pair' ? MapArityErrorCls : VecOrSetArityErrorCls;
      throw new ArityErrorCls({ conduitName, actualArity: paramCount });
    }
  }
  if (shape === 'pair') {
    return async (_mapKey, mapValue) => await predLambda(mapValue);
  }
  return async (item) => await predLambda(item);
}

export const filter = higherOrderOp('filter', 2, async (container, predLambda) => {
  if (isVecShape(container)) {
    const applyItem = containerPredDispatch(predLambda, 'single', FilterVecOrSetPredArityInvalid, FilterMapPredArityInvalid);
    const filterResult = [];
    for (const filterItem of container) {
      const predResult = await applyItem(filterItem);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.push(filterItem);
    }
    return vecLikeOf(filterResult, container);
  }
  if (isQSet(container)) {
    const applyItem = containerPredDispatch(predLambda, 'single', FilterVecOrSetPredArityInvalid, FilterMapPredArityInvalid);
    const filterResult = new Set();
    for (const filterItem of container) {
      const predResult = await applyItem(filterItem);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.add(filterItem);
    }
    return filterResult;
  }
  if (isMapShape(container)) {
    const applyEntry = containerPredDispatch(predLambda, 'pair', FilterVecOrSetPredArityInvalid, FilterMapPredArityInvalid);
    const filterEntries = [];
    for (const [filterKey, filterValue] of mapShapeEntries(container)) {
      const predResult = await applyEntry(filterKey, filterValue);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterEntries.push([filterKey, filterValue]);
    }
    return mapLikeOf(filterEntries, container);
  }
  throw new FilterSubjectNotContainer(container);
});

export const every = higherOrderOp('every', 2, async (container, everyPredLambda) => {
  if (isVecShape(container) || isQSet(container)) {
    const applyItem = containerPredDispatch(everyPredLambda, 'single', EveryVecOrSetPredArityInvalid, EveryMapPredArityInvalid);
    for (const everyItem of container) {
      const everyResult = await applyItem(everyItem);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  if (isMapShape(container)) {
    const applyEntry = containerPredDispatch(everyPredLambda, 'pair', EveryVecOrSetPredArityInvalid, EveryMapPredArityInvalid);
    for (const [everyKey, everyValue] of mapShapeEntries(container)) {
      const everyResult = await applyEntry(everyKey, everyValue);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  throw new EverySubjectNotContainer(container);
});

export const any = higherOrderOp('any', 2, async (container, anyPredLambda) => {
  if (isVecShape(container) || isQSet(container)) {
    const applyItem = containerPredDispatch(anyPredLambda, 'single', AnyVecOrSetPredArityInvalid, AnyMapPredArityInvalid);
    for (const anyItem of container) {
      const anyResult = await applyItem(anyItem);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  if (isMapShape(container)) {
    const applyEntry = containerPredDispatch(anyPredLambda, 'pair', AnyVecOrSetPredArityInvalid, AnyMapPredArityInvalid);
    for (const [anyKey, anyValue] of mapShapeEntries(container)) {
      const anyResult = await applyEntry(anyKey, anyValue);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  throw new AnySubjectNotContainer(container);
});

export const groupBy = higherOrderOp('groupBy', 2, async (vec, groupKeyLambda) => {
  if (!isVecShape(vec)) throw new GroupBySubjectNotVec(vec);
  const groupResult = new Map();
  for (let gi = 0; gi < vec.length; gi++) {
    const groupElem = vec[gi];
    const groupKey = await groupKeyLambda(groupElem);
    if (isErrorValue(groupKey)) return groupKey;
    if (!isKeyword(groupKey)) {
      throw new GroupByKeyNotKeyword({
        index: gi,
        actualType: typeKeyword(groupKey),
        actualValue: groupKey
      });
    }
    if (!groupResult.has(groupKey.name)) groupResult.set(groupKey.name, []);
    groupResult.get(groupKey.name).push(groupElem);
  }
  return groupResult;
});

export const indexBy = higherOrderOp('indexBy', 2, async (vec, indexKeyLambda) => {
  if (!isVecShape(vec)) throw new IndexBySubjectNotVec(vec);
  const indexResult = new Map();
  for (let ii = 0; ii < vec.length; ii++) {
    const indexElem = vec[ii];
    const indexKey = await indexKeyLambda(indexElem);
    if (isErrorValue(indexKey)) return indexKey;
    if (!isKeyword(indexKey)) {
      throw new IndexByKeyNotKeyword({
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
  0: (vec) => {
    if (!isVecShape(vec)) throw new SortNaturalSubjectNotVec(vec);
    const sorted = [...vec].sort((a, b) => {
      checkComparable(SortNaturalNotComparable, a, b);
      return compareScalars(a, b);
    });
    return vecLikeOf(sorted, vec);
  },
  1: async (vec, sortKeyLambda) => {
    if (!isVecShape(vec)) throw new SortByKeySubjectNotVec(vec);
    const sortEntries = await Promise.all(
      [...vec].map(async (sortElem) => ({
        sortElem,
        sortKey: await sortKeyLambda(sortElem)
      }))
    );
    sortEntries.sort((a, b) => {
      checkComparable(SortByKeyNotComparable, a.sortKey, b.sortKey);
      return compareScalars(a.sortKey, b.sortKey);
    });
    return vecLikeOf(sortEntries.map(entry => entry.sortElem), vec);
  }
});

function compareScalars(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const take = valueOp('take', 2, (vec, n) => {
  if (!isVecShape(vec)) throw new TakeSubjectNotVec(vec);
  if (typeof n !== 'number') throw new TakeCountNotNumber(n);
  return vecLikeOf(vec.slice(0, n), vec);
});

// `at` — indexed access with Array.prototype.at-style negative indices.
// Out-of-bounds returns null, mirroring the Map-miss / Vec-miss symmetry
// of the projection operator. Non-integer Number subjects (e.g. `at(0.5)`)
// raise a modifier-shape error because silent coercion would mask the
// caller's intent. `last` remains in the catalog as the idiomatic shorthand
// for `at(-1)`; the two are semantically identical.
const AtSubjectNotVecOrMap = declareSubjectError('AtSubjectNotVecOrMap', 'at', ['vec', 'map']);
const AtKeyNotString       = declareModifierError('AtKeyNotString', 'at', 2, 'string');

export const at = valueOp('at', 2, (subject, atKey) => {
  if (isVecShape(subject)) {
    if (typeof atKey !== 'number' || !Number.isInteger(atKey)) {
      throw new AtIndexNotInteger(atKey);
    }
    const resolvedIndex = atKey < 0 ? subject.length + atKey : atKey;
    return (resolvedIndex >= 0 && resolvedIndex < subject.length) ? subject[resolvedIndex] : NULL;
  }
  if (isMapShape(subject)) {
    if (typeof atKey !== 'string') throw new AtKeyNotString(atKey);
    return mapShapeHas(subject, atKey) ? mapShapeGet(subject, atKey) : NULL;
  }
  throw new AtSubjectNotVecOrMap(subject);
});

export const drop = valueOp('drop', 2, (vec, n) => {
  if (!isVecShape(vec)) throw new DropSubjectNotVec(vec);
  if (typeof n !== 'number') throw new DropCountNotNumber(n);
  return vecLikeOf(vec.slice(n), vec);
});

// `distinct` dedupes by structural equality, aligning with the `eq`
// operand: `[x, y] | distinct` collapses to `[x]` iff `x | eq(y)`.
// Two Map objects carrying identical content — the common shape a
// recursive graph walk produces when it reaches the same logical node
// via multiple paths (diamond hierarchies, fan-in references) — are
// therefore one.
//
// Hybrid dedup: primitives and interned keywords use a JS Set (their
// ref-eq is structural — same-name keywords intern to the same object,
// scalars compare by value), so atom-heavy input stays O(n). Vec, Map,
// Set, and error values fall through to a structural scan over the
// composite-seen list. Mixed input is bucketed per element.
export const distinct = nullaryOp('distinct', (vec) => {
  if (!isVecShape(vec)) throw new DistinctSubjectNotVec(vec);
  const seenAtoms = new Set();
  const seenKeywordNames = new Set();
  const seenComposite = [];
  const result = [];
  for (const v of vec) {
    if (isKeyword(v)) {
      if (seenKeywordNames.has(v.name)) continue;
      seenKeywordNames.add(v.name);
      result.push(v);
    } else if (v !== null && typeof v === 'object') {
      if (seenComposite.some(prev => deepEqual(prev, v))) continue;
      seenComposite.push(v);
      result.push(v);
    } else {
      if (seenAtoms.has(v)) continue;
      seenAtoms.add(v);
      result.push(v);
    }
  }
  return vecLikeOf(result, vec);
});

export const reverse = nullaryOp('reverse', (vec) => {
  if (!isVecShape(vec)) throw new ReverseSubjectNotVec(vec);
  return vecLikeOf([...vec].reverse(), vec);
});

export const flat = nullaryOp('flat', (vec) => {
  if (!isVecShape(vec)) throw new FlatSubjectNotVec(vec);
  const result = [];
  for (const item of vec) {
    if (isVecShape(item)) result.push(...item);
    else result.push(item);
  }
  return vecLikeOf(result, vec);
});

// ── sortWith and comparator builders ──────────────────────────

export const sortWith = higherOrderOp('sortWith', 2, async (vec, cmpLambda) => {
  if (!isVecShape(vec)) throw new SortWithSubjectNotVec(vec);
  // Array.sort is synchronous; we precompute all pairwise comparisons
  // would be complex. Instead, use an async-compatible merge sort approach:
  // precompute comparison matrix or use a simple insertion sort with awaits.
  // Pragmatic approach: use a comparison cache with indices.
  const sortWithSource = vec;
  const sortWithArr = [...vec];
  const sortWithLen = sortWithArr.length;
  // Insertion sort with async comparator — O(n²) but correct with async.
  for (let outerIdx = 1; outerIdx < sortWithLen; outerIdx++) {
    const sortWithCurrent = sortWithArr[outerIdx];
    let insertIdx = outerIdx - 1;
    while (insertIdx >= 0) {
      const cmpPair = new Map();
      cmpPair.set('left', sortWithArr[insertIdx]);
      cmpPair.set('right', sortWithCurrent);
      const cmpResult = await cmpLambda(cmpPair);
      if (typeof cmpResult !== 'number') {
        throw new SortWithCmpResultNotNumber({
          actualType: typeKeyword(cmpResult),
          actualValue: cmpResult
        });
      }
      if (cmpResult <= 0) break;
      sortWithArr[insertIdx + 1] = sortWithArr[insertIdx];
      insertIdx--;
    }
    sortWithArr[insertIdx + 1] = sortWithCurrent;
  }
  return vecLikeOf(sortWithArr, sortWithSource);
});

export const asc = higherOrderOp('asc', 2, async (pair, ascKeyLambda) => {
  if (!isQMap(pair)) throw new AscPairNotMap({
    actualType: typeKeyword(pair), actualValue: pair
  });
  const ascLeft  = pair.get('left');
  const ascRight = pair.get('right');
  const ascLeftKey  = await ascKeyLambda(ascLeft);
  const ascRightKey = await ascKeyLambda(ascRight);
  checkComparable(AscKeysNotComparable, ascLeftKey, ascRightKey);
  return compareScalars(ascLeftKey, ascRightKey);
});

export const desc = higherOrderOp('desc', 2, async (pair, descKeyLambda) => {
  if (!isQMap(pair)) throw new DescPairNotMap({
    actualType: typeKeyword(pair), actualValue: pair
  });
  const descLeft  = pair.get('left');
  const descRight = pair.get('right');
  const descLeftKey  = await descKeyLambda(descLeft);
  const descRightKey = await descKeyLambda(descRight);
  checkComparable(DescKeysNotComparable, descLeftKey, descRightKey);
  return -compareScalars(descLeftKey, descRightKey);
});

async function nullsKeyComparator(pair, nullsKeyLambda, nullFirst, PairNotMapError, KeysNotComparableError) {
  if (!isQMap(pair)) throw new PairNotMapError({ actualType: typeKeyword(pair), actualValue: pair });
  const nullsLeft  = pair.get('left');
  const nullsRight = pair.get('right');
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
  if (!isVecShape(vec)) throw new FirstNonZeroSubjectNotVec(vec);
  for (let i = 0; i < vec.length; i++) {
    if (typeof vec[i] !== 'number') {
      throw new FirstNonZeroElementNotNumber(i, vec[i]);
    }
    if (vec[i] !== 0) return vec[i];
  }
  return 0;
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/count',        count);
PRIMITIVE_REGISTRY.bind('qlang/prim/empty',        empty);
PRIMITIVE_REGISTRY.bind('qlang/prim/first',        first);
PRIMITIVE_REGISTRY.bind('qlang/prim/last',         last);
PRIMITIVE_REGISTRY.bind('qlang/prim/sum',          sum);
PRIMITIVE_REGISTRY.bind('qlang/prim/min',          min);
PRIMITIVE_REGISTRY.bind('qlang/prim/max',          max);
PRIMITIVE_REGISTRY.bind('qlang/prim/filter',       filter);
PRIMITIVE_REGISTRY.bind('qlang/prim/every',        every);
PRIMITIVE_REGISTRY.bind('qlang/prim/any',          any);
PRIMITIVE_REGISTRY.bind('qlang/prim/groupBy',      groupBy);
PRIMITIVE_REGISTRY.bind('qlang/prim/indexBy',      indexBy);
PRIMITIVE_REGISTRY.bind('qlang/prim/sort',         sort);
PRIMITIVE_REGISTRY.bind('qlang/prim/take',         take);
PRIMITIVE_REGISTRY.bind('qlang/prim/at',           at);
PRIMITIVE_REGISTRY.bind('qlang/prim/drop',         drop);
PRIMITIVE_REGISTRY.bind('qlang/prim/distinct',     distinct);
PRIMITIVE_REGISTRY.bind('qlang/prim/reverse',      reverse);
PRIMITIVE_REGISTRY.bind('qlang/prim/flat',         flat);
PRIMITIVE_REGISTRY.bind('qlang/prim/sortWith',     sortWith);
PRIMITIVE_REGISTRY.bind('qlang/prim/asc',          asc);
PRIMITIVE_REGISTRY.bind('qlang/prim/desc',         desc);
PRIMITIVE_REGISTRY.bind('qlang/prim/nullsFirst',   nullsFirst);
PRIMITIVE_REGISTRY.bind('qlang/prim/nullsLast',    nullsLast);
PRIMITIVE_REGISTRY.bind('qlang/prim/firstNonZero', firstNonZero);

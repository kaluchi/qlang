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
//   3+-arity → per-operand arityError. The language does not
//     pair-encode keys/values into a single argument; higher arities
//     are not meaningful for entry iteration.
//
// Every type check inlines its own `throw new X(...)` statement
// so the class name and source line uniquely identify the failing
// site.
//
// Meta lives in lib/qlang/operand/vec.qlang.

import { valueOp, higherOrderOp, nullaryOp, overloadedOp } from './dispatch.mjs';
import {
  isQMap, isQSet, isKeyword, isTagKeyword, isTruthy, isErrorValue, typeKeyword,
  NULL, keyword, isVecShape, isMapShape, mapShapeEntries, mapShapeSize,
  mapShapeGet, mapShapeHas, vecLikeOf, mapLikeOf,
  isJsonArray, JSON_ARRAY_TAG, TAG_HEADER_SYMBOL, stampTagHeader
} from '../types.mjs';
import { addStructurallyUnique } from '../equality.mjs';

// isOrderedSequence(v) — Vec / JsonArray / Set. The shape over which
// every order-aware operand (first / last / take / drop / reverse /
// sort / sortWith / at / flat) dispatches polymorphically. Set is
// insertion-ordered + structurally-unique by §Set in qlang-spec.md,
// so first-added is well-defined and slicing/reordering operations
// keep meaning. Returns the elements as an iterable view together
// with the discriminator that `containerLikeOf` reads back to mint
// a same-shape result.
function isOrderedSequence(v) {
  return isVecShape(v) || isQSet(v);
}

// sequenceElements(v) — array view of a Vec / JsonArray / Set
// subject. Vec / JsonArray yield themselves; Set is spread into an
// array in insertion-order. Used by order-aware operands that need
// indexed access (first / last / at) or full materialisation
// (sort / sortWith).
function sequenceElements(v) {
  if (isVecShape(v)) return v;
  return [...v];
}

// containerLikeOf(items, source) — minting site for shape-preserving
// transformers (filter / take / drop / reverse / sort / sortWith /
// flat) over an ordered sequence. Three shape signals carry through:
//   - JsonArray vs Vec — `vecLikeOf` re-stamps `JSON_ARRAY_TAG`
//     when the source carries it.
//   - Set vs Vec — Set re-mints with structural dedup (the only
//     path where dedup is needed in this module — slice / reverse
//     / sort over a Set inherit Set members which are already
//     unique, but `flat` on a Set of Vecs may introduce duplicates
//     that addStructurallyUnique has to collapse).
//   - TaggedInstance identity — when the source is a tagged
//     composite (`::Box[…]`, `::Tag#[…]`, `::Tag(::json[…])`), the
//     `TAG_HEADER_SYMBOL` slot copies onto the result so the
//     downstream `type` axis still reads `::Box` after the
//     transform. Same single-mint pattern keeps every consumer
//     symmetric without per-operand stamping.
function containerLikeOf(items, source) {
  let result;
  if (isQSet(source)) {
    result = new Set();
    for (const v of items) addStructurallyUnique(result, v);
  } else if (isJsonArray(source)) {
    // Build the JsonArray inline rather than through `vecLikeOf`'s
    // `makeJsonArray` path — the latter freezes its output, which
    // would block the downstream TaggedInstance header stamp.
    // Defer the freeze until both JSON_ARRAY_TAG and the optional
    // TAG_HEADER_SYMBOL are in place.
    result = [...items];
    Object.defineProperty(result, JSON_ARRAY_TAG, {
      value: true, enumerable: false, configurable: false, writable: false
    });
  } else {
    result = vecLikeOf(items, source);
  }
  const sourceTag = source[TAG_HEADER_SYMBOL];
  if (sourceTag !== undefined) stampTagHeader(result, sourceTag);
  if (isJsonArray(source)) Object.freeze(result);
  return result;
}
import {
  declareSubjectError,
  declareModifierError,
  declareElementError,
  declareComparabilityError,
  declareShapeError,
  declareArityError
} from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';
import {
  resolveCapturedConduit,
  invokeConduitWithFixedArgs,
  CONDUIT_PARAMS_FIELD
} from '../eval.mjs';

// ── Subject-type classes ───────────────────────────────────────

const CountSubjectNotContainerError    = declareSubjectError('CountSubjectNotContainerError',    'count',    ['vec', 'set', 'map']);
const EmptySubjectNotContainerError    = declareSubjectError('EmptySubjectNotContainerError',    'empty',    ['vec', 'set', 'map']);
const FirstSubjectNotSequenceError     = declareSubjectError('FirstSubjectNotSequenceError',     'first',    ['vec', 'set']);
const LastSubjectNotSequenceError      = declareSubjectError('LastSubjectNotSequenceError',      'last',     ['vec', 'set']);
const SumSubjectNotVecOrSetError       = declareSubjectError('SumSubjectNotVecOrSetError',       'sum',      ['vec', 'set']);
const MinSubjectNotVecOrSetError       = declareSubjectError('MinSubjectNotVecOrSetError',       'min',      ['vec', 'set']);
const MaxSubjectNotVecOrSetError       = declareSubjectError('MaxSubjectNotVecOrSetError',       'max',      ['vec', 'set']);
const FilterSubjectNotContainerError   = declareSubjectError('FilterSubjectNotContainerError',   'filter',   ['vec', 'set', 'map']);
const EverySubjectNotContainerError    = declareSubjectError('EverySubjectNotContainerError',    'every',    ['vec', 'set', 'map']);
const AnySubjectNotContainerError      = declareSubjectError('AnySubjectNotContainerError',      'any',      ['vec', 'set', 'map']);

// Per-operand arity-invalid classes — predicate conduit arity limits
// at each filter/every/any call site. On Vec or Set the predicate has
// one axis: 0 params read element-as-pipeValue, 1 param [:x] binds the
// element as a named captured-arg. Two or more params on Vec/Set have
// no axis to fill → per-operand *VecOrSetPredArityInvalid. On Map the
// predicate has two axes: 0/1 read value; 2 params [:k :v] bind both.
// Three or more on Map → per-operand *MapPredArityInvalid.
const FilterVecOrSetPredArityInvalidError = declareArityError('FilterVecOrSetPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `filter over Vec or Set requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`);
const EveryVecOrSetPredArityInvalidError  = declareArityError('EveryVecOrSetPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `every over Vec or Set requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`);
const AnyVecOrSetPredArityInvalidError    = declareArityError('AnyVecOrSetPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `any over Vec or Set requires a predicate conduit with 0 or 1 params, got conduit '${conduitName}' with ${actualArity} params`);
const FilterMapPredArityInvalidError = declareArityError('FilterMapPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `filter over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const EveryMapPredArityInvalidError  = declareArityError('EveryMapPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `every over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const AnyMapPredArityInvalidError    = declareArityError('AnyMapPredArityInvalidError',
  ({ conduitName, actualArity }) =>
    `any over Map requires a predicate conduit with 0, 1, or 2 params, got conduit '${conduitName}' with ${actualArity} params`);
const GroupBySubjectNotSequenceError   = declareSubjectError('GroupBySubjectNotSequenceError',   'groupBy',  ['vec', 'set']);
const IndexBySubjectNotSequenceError   = declareSubjectError('IndexBySubjectNotSequenceError',   'indexBy',  ['vec', 'set']);
const GroupByKeyNotKeywordError        = declareShapeError('GroupByKeyNotKeywordError',
  ({ index, actualType }) => `groupBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`);
const IndexByKeyNotKeywordError        = declareShapeError('IndexByKeyNotKeywordError',
  ({ index, actualType }) => `indexBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType.name}`);
const SortNaturalSubjectNotSequenceError = declareSubjectError('SortNaturalSubjectNotSequenceError', 'sort',     ['vec', 'set']);
const SortByKeySubjectNotSequenceError   = declareSubjectError('SortByKeySubjectNotSequenceError',   'sort',     ['vec', 'set']);
const SortWithSubjectNotSequenceError    = declareSubjectError('SortWithSubjectNotSequenceError',    'sortWith', ['vec', 'set']);
const FirstNonZeroSubjectNotVecError     = declareSubjectError('FirstNonZeroSubjectNotVecError',     'firstNonZero', 'vec');
const TakeSubjectNotSequenceError        = declareSubjectError('TakeSubjectNotSequenceError',        'take',     ['vec', 'set']);
const DropSubjectNotSequenceError        = declareSubjectError('DropSubjectNotSequenceError',        'drop',     ['vec', 'set']);
const DistinctSubjectNotSequenceError    = declareSubjectError('DistinctSubjectNotSequenceError',    'distinct', ['vec', 'set']);
const ReverseSubjectNotSequenceError     = declareSubjectError('ReverseSubjectNotSequenceError',     'reverse',  ['vec', 'set']);
const FlatSubjectNotSequenceError        = declareSubjectError('FlatSubjectNotSequenceError',        'flat',     ['vec', 'set']);

const TakeCountNotNumberError = declareModifierError('TakeCountNotNumberError', 'take', 2, 'number');
const DropCountNotNumberError = declareModifierError('DropCountNotNumberError', 'drop', 2, 'number');
const AtIndexNotIntegerError  = declareModifierError('AtIndexNotIntegerError', 'at',   2, 'integer');

const SumElementNotNumberError          = declareElementError('SumElementNotNumberError',          'sum',          'number');
const FirstNonZeroElementNotNumberError = declareElementError('FirstNonZeroElementNotNumberError', 'firstNonZero', 'number');

const MinElementsNotComparableError    = declareComparabilityError('MinElementsNotComparableError',    'min');
const MaxElementsNotComparableError    = declareComparabilityError('MaxElementsNotComparableError',    'max');
const SortNaturalNotComparableError    = declareComparabilityError('SortNaturalNotComparableError',    'sort');
const SortByKeyNotComparableError      = declareComparabilityError('SortByKeyNotComparableError',      'sort');
const AscKeysNotComparableError        = declareComparabilityError('AscKeysNotComparableError',        'asc');
const DescKeysNotComparableError       = declareComparabilityError('DescKeysNotComparableError',       'desc');
const NullsFirstKeysNotComparableError = declareComparabilityError('NullsFirstKeysNotComparableError', 'nullsFirst');
const NullsLastKeysNotComparableError  = declareComparabilityError('NullsLastKeysNotComparableError',  'nullsLast');

const SortWithCmpResultNotNumberError = declareShapeError('SortWithCmpResultNotNumberError',
  ({ actualType }) => `sortWith comparator must return a Number, got ${actualType.name}`);
const AscPairNotMapError = declareShapeError('AscPairNotMapError',
  ({ actualType }) => `asc requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);
const DescPairNotMapError = declareShapeError('DescPairNotMapError',
  ({ actualType }) => `desc requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);
const NullsFirstPairNotMapError = declareShapeError('NullsFirstPairNotMapError',
  ({ actualType }) => `nullsFirst requires a pair Map subject ({ :left x :right y }), got ${actualType.name}`);
const NullsLastPairNotMapError = declareShapeError('NullsLastPairNotMapError',
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
  sizeOfContainer(container, CountSubjectNotContainerError));

export const empty = nullaryOp('empty', (container) =>
  sizeOfContainer(container, EmptySubjectNotContainerError) === 0);

// sequenceOrThrow(container, ErrorCls) — array view of an ordered
// sequence (Vec / JsonArray / Set) for reducers that need indexed
// access. Vec / JsonArray pass through; Set spreads in insertion-
// order. Set's insertion-order is part of qlang's public contract
// per §Set in qlang-spec.md, so order-dependent operands (first /
// last / at / sort / reverse / take / drop / flat) compose
// meaningfully with a Set subject.
function sequenceOrThrow(container, ErrorCls) {
  if (isVecShape(container)) return container;
  if (isQSet(container))     return [...container];
  throw new ErrorCls(container);
}

// O(1) Set fast path — `subject.values().next().value` skips the
// `[...subject]` materialization `sequenceOrThrow` performs.
export const first = nullaryOp('first', (subject) => {
  if (isVecShape(subject)) {
    return subject.length === 0 ? NULL : subject[0];
  }
  if (isQSet(subject)) {
    return subject.size === 0 ? NULL : subject.values().next().value;
  }
  throw new FirstSubjectNotSequenceError(subject);
});

export const last = nullaryOp('last', (subject) => {
  const items = sequenceOrThrow(subject, LastSubjectNotSequenceError);
  return items.length === 0 ? NULL : items[items.length - 1];
});

export const sum = nullaryOp('sum', (container) => {
  const items = sequenceOrThrow(container, SumSubjectNotVecOrSetError);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'number') {
      throw new SumElementNotNumberError(i, items[i]);
    }
    total += items[i];
  }
  return total;
});

export const min = nullaryOp('min', (container) => {
  const items = sequenceOrThrow(container, MinSubjectNotVecOrSetError);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    checkComparable(MinElementsNotComparableError, acc, items[i]);
    if (compareScalars(items[i], acc) < 0) acc = items[i];
  }
  return acc;
});

export const max = nullaryOp('max', (container) => {
  const items = sequenceOrThrow(container, MaxSubjectNotVecOrSetError);
  if (items.length === 0) return NULL;
  let acc = items[0];
  for (let i = 1; i < items.length; i++) {
    checkComparable(MaxElementsNotComparableError, acc, items[i]);
    if (compareScalars(items[i], acc) > 0) acc = items[i];
  }
  return acc;
});

// checkComparable / compareScalars — the ordering primitives every
// sort / min / max / gt-family operand routes through. Three matched-
// type pairings are well-defined: Number↔Number, String↔String, and
// identifier-shape pairs (Keyword↔Keyword and TagKeyword↔TagKeyword).
// Identifier pairs compare lexicographically by `.name` — the same
// `.name` field that drives keyword identity and `manifest`
// alphabetical sort — so `[:x :y] | sort`, `#[:b :a :c] | sort`,
// and `[::A ::B] | sort` all behave the natural way without per-call
// `as(:k) | k | keyword` ceremony to dip into the string axis.
// Cross-type ordering (Keyword vs String, Number vs Boolean, …)
// stays a comparability error — silent coercion across value-classes
// would mask the typical bug «sort a heterogeneous collection by
// accident». TagKeyword cross-pairs with Keyword stay disallowed —
// they live in different namespaces and ordering across them carries
// no spec meaning.
function checkComparable(ErrorCls, left, right) {
  const bothNumbers     = typeof left === 'number' && typeof right === 'number';
  const bothStrings     = typeof left === 'string' && typeof right === 'string';
  const bothKeywords    = isKeyword(left)    && isKeyword(right);
  const bothTagKeywords = isTagKeyword(left) && isTagKeyword(right);
  if (!bothNumbers && !bothStrings && !bothKeywords && !bothTagKeywords) {
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
// because `:params.length` is static — the dispatch rejects up
// front with a shape-specific class, sparing every entry from
// a generic ConduitArityMismatchError.
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
  if (isOrderedSequence(container)) {
    const applyItem = containerPredDispatch(predLambda, 'single', FilterVecOrSetPredArityInvalidError, FilterMapPredArityInvalidError);
    const filterResult = [];
    for (const filterItem of container) {
      const predResult = await applyItem(filterItem);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterResult.push(filterItem);
    }
    return containerLikeOf(filterResult, container);
  }
  if (isMapShape(container)) {
    const applyEntry = containerPredDispatch(predLambda, 'pair', FilterVecOrSetPredArityInvalidError, FilterMapPredArityInvalidError);
    const filterEntries = [];
    for (const [filterKey, filterValue] of mapShapeEntries(container)) {
      const predResult = await applyEntry(filterKey, filterValue);
      if (isErrorValue(predResult)) return predResult;
      if (isTruthy(predResult)) filterEntries.push([filterKey, filterValue]);
    }
    return mapLikeOf(filterEntries, container);
  }
  throw new FilterSubjectNotContainerError(container);
});

export const every = higherOrderOp('every', 2, async (container, everyPredLambda) => {
  if (isVecShape(container) || isQSet(container)) {
    const applyItem = containerPredDispatch(everyPredLambda, 'single', EveryVecOrSetPredArityInvalidError, EveryMapPredArityInvalidError);
    for (const everyItem of container) {
      const everyResult = await applyItem(everyItem);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  if (isMapShape(container)) {
    const applyEntry = containerPredDispatch(everyPredLambda, 'pair', EveryVecOrSetPredArityInvalidError, EveryMapPredArityInvalidError);
    for (const [everyKey, everyValue] of mapShapeEntries(container)) {
      const everyResult = await applyEntry(everyKey, everyValue);
      if (isErrorValue(everyResult)) return everyResult;
      if (!isTruthy(everyResult)) return false;
    }
    return true;
  }
  throw new EverySubjectNotContainerError(container);
});

export const any = higherOrderOp('any', 2, async (container, anyPredLambda) => {
  if (isVecShape(container) || isQSet(container)) {
    const applyItem = containerPredDispatch(anyPredLambda, 'single', AnyVecOrSetPredArityInvalidError, AnyMapPredArityInvalidError);
    for (const anyItem of container) {
      const anyResult = await applyItem(anyItem);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  if (isMapShape(container)) {
    const applyEntry = containerPredDispatch(anyPredLambda, 'pair', AnyVecOrSetPredArityInvalidError, AnyMapPredArityInvalidError);
    for (const [anyKey, anyValue] of mapShapeEntries(container)) {
      const anyResult = await applyEntry(anyKey, anyValue);
      if (isErrorValue(anyResult)) return anyResult;
      if (isTruthy(anyResult)) return true;
    }
    return false;
  }
  throw new AnySubjectNotContainerError(container);
});

// groupBy on a Set subject mints Set-typed buckets so the value-class
// signal of the original sequence (uniqueness) survives partitioning.
// On a Vec / JsonArray subject the buckets are same-shape Vec / JsonArray
// — same construction-time invariant kept on each branch.
export const groupBy = higherOrderOp('groupBy', 2, async (subject, groupKeyLambda) => {
  const items = sequenceOrThrow(subject, GroupBySubjectNotSequenceError);
  const subjectIsSet = isQSet(subject);
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
    if (!groupResult.has(groupKey.name)) {
      groupResult.set(groupKey.name, subjectIsSet ? new Set() : []);
    }
    const bucket = groupResult.get(groupKey.name);
    if (subjectIsSet) addStructurallyUnique(bucket, groupElem);
    else bucket.push(groupElem);
  }
  if (!subjectIsSet) {
    for (const [bucketKey, bucketItems] of groupResult) {
      groupResult.set(bucketKey, vecLikeOf(bucketItems, subject));
    }
  }
  return groupResult;
});

export const indexBy = higherOrderOp('indexBy', 2, async (subject, indexKeyLambda) => {
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
    const items = sequenceOrThrow(subject, SortNaturalSubjectNotSequenceError);
    const sorted = [...items].sort((a, b) => {
      checkComparable(SortNaturalNotComparableError, a, b);
      return compareScalars(a, b);
    });
    return containerLikeOf(sorted, subject);
  },
  1: async (subject, sortKeyLambda) => {
    const items = sequenceOrThrow(subject, SortByKeySubjectNotSequenceError);
    const sortEntries = await Promise.all(
      items.map(async (sortElem) => ({
        sortElem,
        sortKey: await sortKeyLambda(sortElem)
      }))
    );
    sortEntries.sort((a, b) => {
      checkComparable(SortByKeyNotComparableError, a.sortKey, b.sortKey);
      return compareScalars(a.sortKey, b.sortKey);
    });
    return containerLikeOf(sortEntries.map(entry => entry.sortElem), subject);
  }
});

function compareScalars(a, b) {
  if (isKeyword(a) || isTagKeyword(a)) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const take = valueOp('take', 2, (subject, n) => {
  if (!isOrderedSequence(subject)) throw new TakeSubjectNotSequenceError(subject);
  if (typeof n !== 'number') throw new TakeCountNotNumberError(n);
  const items = sequenceElements(subject);
  return containerLikeOf(items.slice(0, n), subject);
});

// `at` — indexed access with Array.prototype.at-style negative indices.
// Out-of-bounds returns null, mirroring the Map-miss / Vec-miss symmetry
// of the projection operator. Non-integer Number subjects (e.g. `at(0.5)`)
// raise a modifier-shape error because silent coercion would mask the
// caller's intent. `last` remains in the catalog as the idiomatic shorthand
// for `at(-1)`; the two are semantically identical. Set is polymorphic
// here through insertion-order indexing — `myset | at(0)` returns the
// first-added element, same definition `first` uses.
const AtSubjectNotSequenceOrMapError  = declareSubjectError('AtSubjectNotSequenceOrMapError', 'at', ['vec', 'set', 'map']);
const AtKeyNotKeywordOrStringError    = declareModifierError('AtKeyNotKeywordOrStringError',  'at', 2, ['keyword', 'string']);

// Map-shape branch is a soft lookup — no key-back-into-container
// roundtrip, so the captured-arg shape can be either Keyword or
// String over every Map-shape subject (both normalise to the
// storage-side String via `key.name`/identity, matching
// `mapShapeHas` / `mapShapeGet`). The `src | keys | first |
// as(:k) | src | at(k)` chain composes through either source
// without an inter-shape coercion.
export const at = valueOp('at', 2, (subject, atKey) => {
  if (isVecShape(subject)) {
    if (typeof atKey !== 'number' || !Number.isInteger(atKey)) {
      throw new AtIndexNotIntegerError(atKey);
    }
    const resolvedIndex = atKey < 0 ? subject.length + atKey : atKey;
    return (resolvedIndex >= 0 && resolvedIndex < subject.length) ? subject[resolvedIndex] : NULL;
  }
  if (isQSet(subject)) {
    if (typeof atKey !== 'number' || !Number.isInteger(atKey)) {
      throw new AtIndexNotIntegerError(atKey);
    }
    const items = [...subject];
    const resolvedIndex = atKey < 0 ? items.length + atKey : atKey;
    return (resolvedIndex >= 0 && resolvedIndex < items.length) ? items[resolvedIndex] : NULL;
  }
  if (isMapShape(subject)) {
    let lookupKey;
    if (isKeyword(atKey)) lookupKey = atKey.name;
    else if (typeof atKey === 'string') lookupKey = atKey;
    else throw new AtKeyNotKeywordOrStringError(atKey);
    return mapShapeHas(subject, lookupKey) ? mapShapeGet(subject, lookupKey) : NULL;
  }
  throw new AtSubjectNotSequenceOrMapError(subject);
});

export const drop = valueOp('drop', 2, (subject, n) => {
  if (!isOrderedSequence(subject)) throw new DropSubjectNotSequenceError(subject);
  if (typeof n !== 'number') throw new DropCountNotNumberError(n);
  const items = sequenceElements(subject);
  return containerLikeOf(items.slice(n), subject);
});

// `distinct` is the canonical Vec → Set converter. The return type
// carries the structural-uniqueness invariant in the value-class
// signal (§Set in qlang-spec.md), so downstream operands receive a
// value that announces «no duplicates» on the type plane — no
// defensive `… | distinct` chain needed before subsequent steps.
// Idempotent on a Set subject (Set already carries the invariant).
// Uses `addStructurallyUnique` from `equality.mjs`, the single
// dedup-by-construction primitive that `evalSetLit` and `setops`
// share.
export const distinct = nullaryOp('distinct', (subject) => {
  if (!isOrderedSequence(subject)) throw new DistinctSubjectNotSequenceError(subject);
  if (isQSet(subject)) return subject;
  // Subject reduced to Vec/JsonArray after the Set early-return —
  // iterate the array directly without `sequenceElements` (which
  // would no-op for Vec but would copy a Set, and the Set case
  // never reaches here). TaggedInstance identity copies to the
  // Set result so `::Box[1 2 1] | distinct | type` reads `::Box`
  // — the value-class «no duplicates» signal pivots from Vec to
  // Set, but the per-site identity stays attached.
  const out = new Set();
  for (const v of subject) addStructurallyUnique(out, v);
  const subjectTag = subject[TAG_HEADER_SYMBOL];
  if (subjectTag !== undefined) stampTagHeader(out, subjectTag);
  return out;
});

export const reverse = nullaryOp('reverse', (subject) => {
  if (!isOrderedSequence(subject)) throw new ReverseSubjectNotSequenceError(subject);
  // Single copy via spread — works uniformly across Vec / JsonArray
  // / Set (all iterable). `sequenceElements` on a Set would copy
  // first, then `[...…]` again, doubling the work.
  return containerLikeOf([...subject].reverse(), subject);
});

// `flat` lifts one level of nesting. On Set subject the inner Set / Vec
// elements splice into a fresh Set with `addStructurallyUnique` collapsing
// any cross-bucket duplicates, so the result still carries the Set
// signal. On Vec / JsonArray subject inner sequences splice in order
// without dedup, matching the existing Vec-flat contract.
export const flat = nullaryOp('flat', (subject) => {
  if (!isOrderedSequence(subject)) throw new FlatSubjectNotSequenceError(subject);
  // Outer and inner iteration both go through the value directly —
  // spread accepts any iterable, so Vec / JsonArray / Set splice
  // in without an intermediate array copy.
  const result = [];
  for (const item of subject) {
    if (isOrderedSequence(item)) result.push(...item);
    else result.push(item);
  }
  return containerLikeOf(result, subject);
});

// ── sortWith and comparator builders ──────────────────────────

export const sortWith = higherOrderOp('sortWith', 2, async (subject, cmpLambda) => {
  if (!isOrderedSequence(subject)) throw new SortWithSubjectNotSequenceError(subject);
  // Insertion sort — `Array.prototype.sort` accepts only a sync
  // comparator, and each pairwise comparison here may invoke a
  // captured-arg lambda that awaits inside the conduit body. The
  // sort stays correct under awaited comparator results; the
  // O(n²) profile is acceptable for the sequence sizes sortWith
  // services (config rows, query results, comparator-built
  // orderings — none of them scale unboundedly).
  const sortWithArr = [...subject];
  const sortWithLen = sortWithArr.length;
  for (let outerIdx = 1; outerIdx < sortWithLen; outerIdx++) {
    const sortWithCurrent = sortWithArr[outerIdx];
    let insertIdx = outerIdx - 1;
    while (insertIdx >= 0) {
      const cmpPair = new Map();
      cmpPair.set('left', sortWithArr[insertIdx]);
      cmpPair.set('right', sortWithCurrent);
      const cmpResult = await cmpLambda(cmpPair);
      if (typeof cmpResult !== 'number') {
        throw new SortWithCmpResultNotNumberError({
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
  return containerLikeOf(sortWithArr, subject);
});

export const asc = higherOrderOp('asc', 2, async (pair, ascKeyLambda) => {
  if (!isQMap(pair)) throw new AscPairNotMapError({
    actualType: typeKeyword(pair), actualValue: pair
  });
  const ascLeft  = pair.get('left');
  const ascRight = pair.get('right');
  const ascLeftKey  = await ascKeyLambda(ascLeft);
  const ascRightKey = await ascKeyLambda(ascRight);
  checkComparable(AscKeysNotComparableError, ascLeftKey, ascRightKey);
  return compareScalars(ascLeftKey, ascRightKey);
});

export const desc = higherOrderOp('desc', 2, async (pair, descKeyLambda) => {
  if (!isQMap(pair)) throw new DescPairNotMapError({
    actualType: typeKeyword(pair), actualValue: pair
  });
  const descLeft  = pair.get('left');
  const descRight = pair.get('right');
  const descLeftKey  = await descKeyLambda(descLeft);
  const descRightKey = await descKeyLambda(descRight);
  checkComparable(DescKeysNotComparableError, descLeftKey, descRightKey);
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
  await nullsKeyComparator(pair, nullsFirstKeyLambda, true, NullsFirstPairNotMapError, NullsFirstKeysNotComparableError));

export const nullsLast = higherOrderOp('nullsLast', 2, async (pair, nullsLastKeyLambda) =>
  await nullsKeyComparator(pair, nullsLastKeyLambda, false, NullsLastPairNotMapError, NullsLastKeysNotComparableError));

export const firstNonZero = nullaryOp('firstNonZero', (vec) => {
  if (!isVecShape(vec)) throw new FirstNonZeroSubjectNotVecError(vec);
  for (let i = 0; i < vec.length; i++) {
    if (typeof vec[i] !== 'number') {
      throw new FirstNonZeroElementNotNumberError(i, vec[i]);
    }
    if (vec[i] !== 0) return vec[i];
  }
  return 0;
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
bindPrim('sortWith',     sortWith);
bindPrim('asc',          asc);
bindPrim('desc',         desc);
bindPrim('nullsFirst',   nullsFirst);
bindPrim('nullsLast',    nullsLast);
bindPrim('firstNonZero', firstNonZero);

// Vec operands.
//
// Reducers (Vec → Scalar) are nullary on the subject. Transformers
// (Vec → Vec) are nullary or higher-order. `count` and `empty`
// are polymorphic over Vec/Set/Map — they answer "how many
// elements?" regardless of container shape.
//
// Every type check inlines its own `throw new X(...)` statement
// so the class name and source line uniquely identify the failing
// site.
//
// Meta lives in manifest.qlang.

import { valueOp, higherOrderOp, nullaryOp, overloadedOp } from './dispatch.mjs';
import {
  isVec, isQMap, isQSet, isKeyword, isTruthy, isErrorValue, describeType, NIL, keyword
} from '../types.mjs';
import {
  declareSubjectError,
  declareModifierError,
  declareElementError,
  declareComparabilityError,
  declareShapeError
} from '../operand-errors.mjs';

// ── Subject-type classes ───────────────────────────────────────

const CountSubjectNotContainer    = declareSubjectError('CountSubjectNotContainer',    'count',    'Vec, Set, or Map');
const EmptySubjectNotContainer    = declareSubjectError('EmptySubjectNotContainer',    'empty',    'Vec, Set, or Map');
const FirstSubjectNotVec          = declareSubjectError('FirstSubjectNotVec',          'first',    'Vec');
const LastSubjectNotVec           = declareSubjectError('LastSubjectNotVec',           'last',     'Vec');
const SumSubjectNotVec            = declareSubjectError('SumSubjectNotVec',            'sum',      'Vec');
const MinSubjectNotVec            = declareSubjectError('MinSubjectNotVec',            'min',      'Vec');
const MaxSubjectNotVec            = declareSubjectError('MaxSubjectNotVec',            'max',      'Vec');
const FilterSubjectNotVec         = declareSubjectError('FilterSubjectNotVec',         'filter',   'Vec');
const EverySubjectNotVec          = declareSubjectError('EverySubjectNotVec',          'every',    'Vec');
const AnySubjectNotVec            = declareSubjectError('AnySubjectNotVec',            'any',      'Vec');
const GroupBySubjectNotVec        = declareSubjectError('GroupBySubjectNotVec',        'groupBy',  'Vec');
const IndexBySubjectNotVec        = declareSubjectError('IndexBySubjectNotVec',        'indexBy',  'Vec');
const GroupByKeyNotKeyword        = declareShapeError('GroupByKeyNotKeyword',
  ({ index, actualType }) => `groupBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType}`);
const IndexByKeyNotKeyword        = declareShapeError('IndexByKeyNotKeyword',
  ({ index, actualType }) => `indexBy: key sub-pipeline must produce a keyword for every element, element ${index} produced ${actualType}`);
const SortNaturalSubjectNotVec    = declareSubjectError('SortNaturalSubjectNotVec',    'sort',     'Vec');
const SortByKeySubjectNotVec      = declareSubjectError('SortByKeySubjectNotVec',      'sort',     'Vec');
const SortWithSubjectNotVec       = declareSubjectError('SortWithSubjectNotVec',       'sortWith', 'Vec');
const FirstNonZeroSubjectNotVec   = declareSubjectError('FirstNonZeroSubjectNotVec',   'firstNonZero', 'Vec of numbers');
const TakeSubjectNotVec           = declareSubjectError('TakeSubjectNotVec',           'take',     'Vec');
const DropSubjectNotVec           = declareSubjectError('DropSubjectNotVec',           'drop',     'Vec');
const DistinctSubjectNotVec       = declareSubjectError('DistinctSubjectNotVec',       'distinct', 'Vec');
const ReverseSubjectNotVec        = declareSubjectError('ReverseSubjectNotVec',        'reverse',  'Vec');
const FlatSubjectNotVec           = declareSubjectError('FlatSubjectNotVec',           'flat',     'Vec');

const TakeCountNotNumber = declareModifierError('TakeCountNotNumber', 'take', 2, 'number');
const DropCountNotNumber = declareModifierError('DropCountNotNumber', 'drop', 2, 'number');

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
  ({ actualType }) => `sortWith comparator must return a number, got ${actualType}`);
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

export const first = nullaryOp('first', (vec) => {
  if (!isVec(vec)) throw new FirstSubjectNotVec(describeType(vec), vec);
  return vec.length === 0 ? NIL : vec[0];
});

export const last = nullaryOp('last', (vec) => {
  if (!isVec(vec)) throw new LastSubjectNotVec(describeType(vec), vec);
  return vec.length === 0 ? NIL : vec[vec.length - 1];
});

export const sum = nullaryOp('sum', (vec) => {
  if (!isVec(vec)) throw new SumSubjectNotVec(describeType(vec), vec);
  let total = 0;
  for (let i = 0; i < vec.length; i++) {
    if (typeof vec[i] !== 'number') {
      throw new SumElementNotNumber(i, describeType(vec[i]), vec[i]);
    }
    total += vec[i];
  }
  return total;
});

export const min = nullaryOp('min', (vec) => {
  if (!isVec(vec)) throw new MinSubjectNotVec(describeType(vec), vec);
  if (vec.length === 0) return NIL;
  let acc = vec[0];
  for (let i = 1; i < vec.length; i++) {
    checkComparable(MinElementsNotComparable, acc, vec[i]);
    if (vec[i] < acc) acc = vec[i];
  }
  return acc;
});

export const max = nullaryOp('max', (vec) => {
  if (!isVec(vec)) throw new MaxSubjectNotVec(describeType(vec), vec);
  if (vec.length === 0) return NIL;
  let acc = vec[0];
  for (let i = 1; i < vec.length; i++) {
    checkComparable(MaxElementsNotComparable, acc, vec[i]);
    if (vec[i] > acc) acc = vec[i];
  }
  return acc;
});

function checkComparable(ErrorCls, left, right) {
  const leftType = describeType(left);
  const rightType = describeType(right);
  const isScalar = (t) => t === 'number' || t === 'string';
  if (!isScalar(leftType) || !isScalar(rightType) || leftType !== rightType) {
    throw new ErrorCls(leftType, rightType);
  }
}

// ── Vec → Vec transformers ─────────────────────────────────────

export const filter = higherOrderOp('filter', 2, (vec, predLambda) => {
  if (!isVec(vec)) throw new FilterSubjectNotVec(describeType(vec), vec);
  const out = [];
  for (const item of vec) {
    const pred = predLambda(item);
    if (isErrorValue(pred)) return pred;
    if (isTruthy(pred)) out.push(item);
  }
  return out;
});

export const every = higherOrderOp('every', 2, (vec, predLambda) => {
  if (!isVec(vec)) throw new EverySubjectNotVec(describeType(vec), vec);
  for (const item of vec) {
    const pred = predLambda(item);
    if (isErrorValue(pred)) return pred;
    if (!isTruthy(pred)) return false;
  }
  return true;
});

export const any = higherOrderOp('any', 2, (vec, predLambda) => {
  if (!isVec(vec)) throw new AnySubjectNotVec(describeType(vec), vec);
  for (const item of vec) {
    const pred = predLambda(item);
    if (isErrorValue(pred)) return pred;
    if (isTruthy(pred)) return true;
  }
  return false;
});

export const groupBy = higherOrderOp('groupBy', 2, (vec, keyLambda) => {
  if (!isVec(vec)) throw new GroupBySubjectNotVec(describeType(vec), vec);
  const result = new Map();
  for (let i = 0; i < vec.length; i++) {
    const elem = vec[i];
    const key = keyLambda(elem);
    if (isErrorValue(key)) return key;
    if (!isKeyword(key)) {
      throw new GroupByKeyNotKeyword({
        index: i,
        actualType: describeType(key),
        actualValue: key
      });
    }
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(elem);
  }
  return result;
});

export const indexBy = higherOrderOp('indexBy', 2, (vec, keyLambda) => {
  if (!isVec(vec)) throw new IndexBySubjectNotVec(describeType(vec), vec);
  const result = new Map();
  for (let i = 0; i < vec.length; i++) {
    const elem = vec[i];
    const key = keyLambda(elem);
    if (isErrorValue(key)) return key;
    if (!isKeyword(key)) {
      throw new IndexByKeyNotKeyword({
        index: i,
        actualType: describeType(key),
        actualValue: key
      });
    }
    result.set(key, elem);
  }
  return result;
});

export const sort = overloadedOp('sort', 2, {
  0: (vec) => {
    if (!isVec(vec)) throw new SortNaturalSubjectNotVec(describeType(vec), vec);
    return [...vec].sort((a, b) => {
      checkComparable(SortNaturalNotComparable, a, b);
      return compareScalars(a, b);
    });
  },
  1: (vec, keyLambda) => {
    if (!isVec(vec)) throw new SortByKeySubjectNotVec(describeType(vec), vec);
    return [...vec].sort((a, b) => {
      const ka = keyLambda(a);
      const kb = keyLambda(b);
      checkComparable(SortByKeyNotComparable, ka, kb);
      return compareScalars(ka, kb);
    });
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

export const sortWith = higherOrderOp('sortWith', 2, (vec, cmpLambda) => {
  if (!isVec(vec)) throw new SortWithSubjectNotVec(describeType(vec), vec);
  return [...vec].sort((a, b) => {
    const pair = new Map();
    pair.set(keyword('left'), a);
    pair.set(keyword('right'), b);
    const result = cmpLambda(pair);
    if (typeof result !== 'number') {
      throw new SortWithCmpResultNotNumber({
        actualType: describeType(result),
        actualValue: result
      });
    }
    return result;
  });
});

export const asc = higherOrderOp('asc', 2, (pair, keyLambda) => {
  if (!isQMap(pair)) throw new AscPairNotMap({
    actualType: describeType(pair), actualValue: pair
  });
  const left  = pair.get(keyword('left'));
  const right = pair.get(keyword('right'));
  const leftKey  = keyLambda(left);
  const rightKey = keyLambda(right);
  checkComparable(AscKeysNotComparable, leftKey, rightKey);
  return compareScalars(leftKey, rightKey);
});

export const desc = higherOrderOp('desc', 2, (pair, keyLambda) => {
  if (!isQMap(pair)) throw new DescPairNotMap({
    actualType: describeType(pair), actualValue: pair
  });
  const left  = pair.get(keyword('left'));
  const right = pair.get(keyword('right'));
  const leftKey  = keyLambda(left);
  const rightKey = keyLambda(right);
  checkComparable(DescKeysNotComparable, leftKey, rightKey);
  return -compareScalars(leftKey, rightKey);
});

function nullsKeyComparator(pair, keyLambda, nilFirst, PairNotMapError, KeysNotComparableError) {
  if (!isQMap(pair)) throw new PairNotMapError({ actualType: describeType(pair), actualValue: pair });
  const left  = pair.get(keyword('left'));
  const right = pair.get(keyword('right'));
  const leftKey  = keyLambda(left);
  const rightKey = keyLambda(right);
  const leftNil  = leftKey === null || leftKey === undefined;
  const rightNil = rightKey === null || rightKey === undefined;
  if (leftNil && rightNil) return 0;
  if (leftNil) return nilFirst ? -1 : 1;
  if (rightNil) return nilFirst ? 1 : -1;
  checkComparable(KeysNotComparableError, leftKey, rightKey);
  return compareScalars(leftKey, rightKey);
}

export const nullsFirst = higherOrderOp('nullsFirst', 2, (pair, keyLambda) =>
  nullsKeyComparator(pair, keyLambda, true, NullsFirstPairNotMap, NullsFirstKeysNotComparable));

export const nullsLast = higherOrderOp('nullsLast', 2, (pair, keyLambda) =>
  nullsKeyComparator(pair, keyLambda, false, NullsLastPairNotMap, NullsLastKeysNotComparable));

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

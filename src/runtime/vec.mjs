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

import { valueOp, higherOrderOp, nullaryOp, overloadedOp } from './dispatch.mjs';
import {
  isVec, isQMap, isQSet, isTruthy, describeType, NIL
} from '../types.mjs';
import {
  declareSubjectError,
  declareModifierError,
  declareElementError,
  declareComparabilityError
} from './operand-errors.mjs';

// ── Subject-type classes ───────────────────────────────────────

const CountSubjectNotContainer    = declareSubjectError('CountSubjectNotContainer',    'count',    'Vec, Set, or Map');
const EmptySubjectNotContainer    = declareSubjectError('EmptySubjectNotContainer',    'empty',    'Vec, Set, or Map');
const FirstSubjectNotVec          = declareSubjectError('FirstSubjectNotVec',          'first',    'Vec');
const LastSubjectNotVec           = declareSubjectError('LastSubjectNotVec',           'last',     'Vec');
const SumSubjectNotVec            = declareSubjectError('SumSubjectNotVec',            'sum',      'Vec');
const MinSubjectNotVec            = declareSubjectError('MinSubjectNotVec',            'min',      'Vec');
const MaxSubjectNotVec            = declareSubjectError('MaxSubjectNotVec',            'max',      'Vec');
const FilterSubjectNotVec         = declareSubjectError('FilterSubjectNotVec',         'filter',   'Vec');
const SortNaturalSubjectNotVec    = declareSubjectError('SortNaturalSubjectNotVec',    'sort',     'Vec');
const SortByKeySubjectNotVec      = declareSubjectError('SortByKeySubjectNotVec',      'sort',     'Vec');
const TakeSubjectNotVec           = declareSubjectError('TakeSubjectNotVec',           'take',     'Vec');
const DropSubjectNotVec           = declareSubjectError('DropSubjectNotVec',           'drop',     'Vec');
const DistinctSubjectNotVec       = declareSubjectError('DistinctSubjectNotVec',       'distinct', 'Vec');
const ReverseSubjectNotVec        = declareSubjectError('ReverseSubjectNotVec',        'reverse',  'Vec');
const FlatSubjectNotVec           = declareSubjectError('FlatSubjectNotVec',           'flat',     'Vec');

// ── Modifier-type classes ──────────────────────────────────────

const TakeCountNotNumber = declareModifierError('TakeCountNotNumber', 'take', 2, 'number');
const DropCountNotNumber = declareModifierError('DropCountNotNumber', 'drop', 2, 'number');

// ── Element-type classes ───────────────────────────────────────

const SumElementNotNumber = declareElementError('SumElementNotNumber', 'sum', 'number');

// ── Comparability classes (each call site is its own class) ───

const MinElementsNotComparable    = declareComparabilityError('MinElementsNotComparable',    'min');
const MaxElementsNotComparable    = declareComparabilityError('MaxElementsNotComparable',    'max');
const SortNaturalNotComparable    = declareComparabilityError('SortNaturalNotComparable',    'sort');
const SortByKeyNotComparable      = declareComparabilityError('SortByKeyNotComparable',      'sort(key)');

// ── Polymorphic sizeOf for count/empty ─────────────────────────

function sizeOfContainer(container, ErrorCls) {
  if (isVec(container))  return container.length;
  if (isQSet(container)) return container.size;
  if (isQMap(container)) return container.size;
  throw new ErrorCls(describeType(container), container);
}

// ── Vec → Scalar reducers ──────────────────────────────────────

export const count = nullaryOp('count', (container) =>
  sizeOfContainer(container, CountSubjectNotContainer), {
  category: 'vec-reducer',
  subject: 'Vec, Set, or Map',
  modifiers: [],
  returns: 'number',
  docs: ['Returns the number of elements. Polymorphic over Vec (length), Set (size), and Map (entry count).'],
  examples: ['[1 2 3] | count → 3', '#{:a :b} | count → 2', '{:x 1 :y 2 :z 3} | count → 3'],
  throws: ['CountSubjectNotContainer']
});

export const empty = nullaryOp('empty', (container) =>
  sizeOfContainer(container, EmptySubjectNotContainer) === 0, {
  category: 'vec-reducer',
  subject: 'Vec, Set, or Map',
  modifiers: [],
  returns: 'boolean',
  docs: ['Returns true if the container has zero elements. Polymorphic over Vec, Set, and Map.'],
  examples: ['[] | empty → true', '[1] | empty → false'],
  throws: ['EmptySubjectNotContainer']
});

export const first = nullaryOp('first', (vec) => {
  if (!isVec(vec)) throw new FirstSubjectNotVec(describeType(vec), vec);
  return vec.length === 0 ? NIL : vec[0];
}, {
  category: 'vec-reducer',
  subject: 'Vec',
  modifiers: [],
  returns: 'any or nil',
  docs: ['Returns the first element of a Vec, or nil if the Vec is empty.'],
  examples: ['[10 20 30] | first → 10', '[] | first → nil'],
  throws: ['FirstSubjectNotVec']
});

export const last = nullaryOp('last', (vec) => {
  if (!isVec(vec)) throw new LastSubjectNotVec(describeType(vec), vec);
  return vec.length === 0 ? NIL : vec[vec.length - 1];
}, {
  category: 'vec-reducer',
  subject: 'Vec',
  modifiers: [],
  returns: 'any or nil',
  docs: ['Returns the last element of a Vec, or nil if the Vec is empty.'],
  examples: ['[10 20 30] | last → 30', '[] | last → nil'],
  throws: ['LastSubjectNotVec']
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
}, {
  category: 'vec-reducer',
  subject: 'Vec of numbers',
  modifiers: [],
  returns: 'number',
  docs: ['Returns the numeric sum of elements. Empty Vec yields 0.'],
  examples: ['[1 2 3 4] | sum → 10', '[] | sum → 0'],
  throws: ['SumSubjectNotVec', 'SumElementNotNumber']
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
}, {
  category: 'vec-reducer',
  subject: 'Vec of comparable scalars',
  modifiers: [],
  returns: 'scalar or nil',
  docs: ['Returns the minimum element under natural ordering. Empty Vec yields nil. All elements must be comparable scalars of the same type.'],
  examples: ['[3 1 4 1 5] | min → 1', '["b" "a" "c"] | min → "a"'],
  throws: ['MinSubjectNotVec', 'MinElementsNotComparable']
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
}, {
  category: 'vec-reducer',
  subject: 'Vec of comparable scalars',
  modifiers: [],
  returns: 'scalar or nil',
  docs: ['Returns the maximum element under natural ordering. Empty Vec yields nil. All elements must be comparable scalars of the same type.'],
  examples: ['[3 1 4 1 5] | max → 5', '["b" "a" "c"] | max → "c"'],
  throws: ['MaxSubjectNotVec', 'MaxElementsNotComparable']
});

// checkComparable — shared gate that asserts both values are
// comparable scalars of the same type and raises the caller's
// specific ComparabilityError subclass on failure. The throw is
// inside the helper but the class identifies the caller uniquely.
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
  return vec.filter(item => isTruthy(predLambda(item)));
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['predicate-lambda'],
  returns: 'Vec',
  docs: ['Keeps elements where the predicate evaluates truthy. The predicate is a sub-pipeline applied to each element via fork.'],
  examples: ['[1 2 3 4 5] | filter(gt(2)) → [3 4 5]', '[{:age 25} {:age 15}] | filter(/age | gte(18)) → [{:age 25}]'],
  throws: ['FilterSubjectNotVec']
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
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['key-lambda (optional)'],
  returns: 'Vec',
  docs: ['Returns a new Vec sorted in natural ascending order. With a key sub-pipeline, sorts by the value the key returns for each element.'],
  examples: ['[3 1 4 1 5] | sort → [1 1 3 4 5]', '[{:age 30} {:age 20}] | sort(/age) → [{:age 20} {:age 30}]'],
  throws: ['SortNaturalSubjectNotVec', 'SortByKeySubjectNotVec', 'SortNaturalNotComparable', 'SortByKeyNotComparable']
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
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['number'],
  returns: 'Vec',
  docs: ['Returns the first n elements. If n exceeds length, returns the whole Vec.'],
  examples: ['[1 2 3 4 5] | take(3) → [1 2 3]'],
  throws: ['TakeSubjectNotVec', 'TakeCountNotNumber']
});

export const drop = valueOp('drop', 2, (vec, n) => {
  if (!isVec(vec)) throw new DropSubjectNotVec(describeType(vec), vec);
  if (typeof n !== 'number') throw new DropCountNotNumber(describeType(n), n);
  return vec.slice(n);
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['number'],
  returns: 'Vec',
  docs: ['Returns the Vec with the first n elements removed. If n exceeds length, returns [].'],
  examples: ['[1 2 3 4 5] | drop(2) → [3 4 5]'],
  throws: ['DropSubjectNotVec', 'DropCountNotNumber']
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
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: [],
  returns: 'Vec',
  docs: ['Returns a new Vec with duplicate elements removed, preserving first-occurrence order.'],
  examples: ['[1 2 1 3 2] | distinct → [1 2 3]'],
  throws: ['DistinctSubjectNotVec']
});

export const reverse = nullaryOp('reverse', (vec) => {
  if (!isVec(vec)) throw new ReverseSubjectNotVec(describeType(vec), vec);
  return [...vec].reverse();
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: [],
  returns: 'Vec',
  docs: ['Returns the Vec in reverse order.'],
  examples: ['[1 2 3] | reverse → [3 2 1]'],
  throws: ['ReverseSubjectNotVec']
});

export const flat = nullaryOp('flat', (vec) => {
  if (!isVec(vec)) throw new FlatSubjectNotVec(describeType(vec), vec);
  const result = [];
  for (const item of vec) {
    if (isVec(item)) result.push(...item);
    else result.push(item);
  }
  return result;
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: [],
  returns: 'Vec',
  docs: ['Flattens one level of nesting. Elements that are Vecs are spliced in; other elements pass through unchanged.'],
  examples: ['[[1 2] [3] [4 5]] | flat → [1 2 3 4 5]'],
  throws: ['FlatSubjectNotVec']
});

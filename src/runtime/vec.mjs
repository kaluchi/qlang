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
  isVec, isQMap, isQSet, isKeyword, isTruthy, describeType, NIL, keyword
} from '../types.mjs';
import {
  declareSubjectError,
  declareModifierError,
  declareElementError,
  declareComparabilityError,
  declareShapeError
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

// ── Modifier-type classes ──────────────────────────────────────

const TakeCountNotNumber = declareModifierError('TakeCountNotNumber', 'take', 2, 'number');
const DropCountNotNumber = declareModifierError('DropCountNotNumber', 'drop', 2, 'number');

// ── Element-type classes ───────────────────────────────────────

const SumElementNotNumber          = declareElementError('SumElementNotNumber',          'sum',          'number');
const FirstNonZeroElementNotNumber = declareElementError('FirstNonZeroElementNotNumber', 'firstNonZero', 'number');

// ── Comparability classes (each call site is its own class) ───

const MinElementsNotComparable    = declareComparabilityError('MinElementsNotComparable',    'min');
const MaxElementsNotComparable    = declareComparabilityError('MaxElementsNotComparable',    'max');
const SortNaturalNotComparable    = declareComparabilityError('SortNaturalNotComparable',    'sort');
const SortByKeyNotComparable      = declareComparabilityError('SortByKeyNotComparable',      'sort(key)');
const AscKeysNotComparable        = declareComparabilityError('AscKeysNotComparable',        'asc');
const DescKeysNotComparable       = declareComparabilityError('DescKeysNotComparable',       'desc');

// Per-site shape errors
const SortWithCmpResultNotNumber = declareShapeError('SortWithCmpResultNotNumber',
  ({ actualType }) => `sortWith comparator must return a number, got ${actualType}`);
const AscPairNotMap = declareShapeError('AscPairNotMap',
  ({ actualType }) => `asc requires a pair Map subject ({ :left x :right y }), got ${actualType}`);
const DescPairNotMap = declareShapeError('DescPairNotMap',
  ({ actualType }) => `desc requires a pair Map subject ({ :left x :right y }), got ${actualType}`);

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

// every / any — boolean fold over Vec elements with a predicate
// sub-pipeline. Symmetric counterparts to filter / coalesce /
// firstTruthy: filter selects matching elements, coalesce/firstTruthy
// pick the first matching alternative, every/any reduce the Vec to
// a single boolean answer.
//
// Both short-circuit on the JS side via Array.prototype.every/some,
// so an `any` over a million elements that hits a truthy at index 3
// invokes the predicate exactly four times. Empty-Vec semantics
// follow the standard reduce-identity convention: vacuously true
// for every (no counter-example), vacuously false for any (no
// witness).

export const every = higherOrderOp('every', 2, (vec, predLambda) => {
  if (!isVec(vec)) throw new EverySubjectNotVec(describeType(vec), vec);
  return vec.every(item => isTruthy(predLambda(item)));
}, {
  category: 'vec-reducer',
  subject: 'Vec',
  modifiers: ['predicate-lambda'],
  returns: 'boolean',
  docs: ['Returns true iff every element of the Vec satisfies the predicate sub-pipeline. Short-circuits on the first falsy result. Vacuously true for the empty Vec (no counter-example exists).'],
  examples: ['[2 4 6 8] | every(gt(0)) → true', '[1 2 3] | every(gt(2)) → false', '[] | every(gt(0)) → true', '[{:active true} {:active true}] | every(/active) → true'],
  throws: ['EverySubjectNotVec']
});

export const any = higherOrderOp('any', 2, (vec, predLambda) => {
  if (!isVec(vec)) throw new AnySubjectNotVec(describeType(vec), vec);
  return vec.some(item => isTruthy(predLambda(item)));
}, {
  category: 'vec-reducer',
  subject: 'Vec',
  modifiers: ['predicate-lambda'],
  returns: 'boolean',
  docs: ['Returns true iff at least one element of the Vec satisfies the predicate sub-pipeline. Short-circuits on the first truthy result. Vacuously false for the empty Vec (no witness exists).'],
  examples: ['[1 2 3] | any(gt(2)) → true', '[1 2 3] | any(gt(99)) → false', '[] | any(gt(0)) → false', '[{:active false} {:active true}] | any(/active) → true'],
  throws: ['AnySubjectNotVec']
});

// groupBy / indexBy — Vec → Map structural reorganization. The
// predicate-aggregation pair (every/any) collapses a Vec to a
// boolean; the comparator pair (asc/desc) builds Vec → Vec
// transformations; this pair builds Vec → Map structures by
// projecting a key-classifier sub-pipeline over each element.
//
//   groupBy(keyFn) — partitions the Vec into a Map<key, Vec<elem>>,
//                    preserving first-occurrence order both for the
//                    Map's entry sequence (insertion order of first
//                    appearance) and for each bucket's elements
//                    (Vec.push order).
//
//   indexBy(keyFn) — collapses the Vec into a Map<key, elem> where
//                    each key maps to the LAST element that produced
//                    it. Last-wins is the standard convention for
//                    "I expect at most one element per key but want
//                    forward-compatible behavior on accidental
//                    duplicates".
//
// Both require the key sub-pipeline to produce a keyword for every
// element — Map keys in qlang are interned keywords, not arbitrary
// values. The strict keyword-key contract maintains the invariant
// that the Map operand catalog (keys, vals, has, /key, union,
// minus, inter) operates uniformly on keyword-keyed Maps.
//
// Both close the Vec ↔ Map duality: `vals` deconstructs a Map into
// a Vec, `groupBy`/`indexBy` construct a Map from a Vec.

export const groupBy = higherOrderOp('groupBy', 2, (vec, keyLambda) => {
  if (!isVec(vec)) throw new GroupBySubjectNotVec(describeType(vec), vec);
  const result = new Map();
  for (let i = 0; i < vec.length; i++) {
    const elem = vec[i];
    const key = keyLambda(elem);
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
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['key sub-pipeline (returns keyword)'],
  returns: 'Map<keyword, Vec<elem>>',
  docs: ['Partitions a Vec into a Map keyed by the result of the key sub-pipeline applied to each element. Preserves first-occurrence order for both the Map entry sequence and each bucket\'s element list. The key sub-pipeline must return a keyword for every element. Inverse of `vals` for the multi-element-per-key case.'],
  examples: [
    '[{:dept :eng :name "a"} {:dept :sales :name "b"} {:dept :eng :name "c"}] | groupBy(/dept) | /eng * /name → ["a" "c"]',
    '[1 2 3 4] | groupBy(if(gt(2), :big, :small)) | /small → [1 2]'
  ],
  throws: ['GroupBySubjectNotVec', 'GroupByKeyNotKeyword']
});

export const indexBy = higherOrderOp('indexBy', 2, (vec, keyLambda) => {
  if (!isVec(vec)) throw new IndexBySubjectNotVec(describeType(vec), vec);
  const result = new Map();
  for (let i = 0; i < vec.length; i++) {
    const elem = vec[i];
    const key = keyLambda(elem);
    if (!isKeyword(key)) {
      throw new IndexByKeyNotKeyword({
        index: i,
        actualType: describeType(key),
        actualValue: key
      });
    }
    result.set(key, elem); // last-wins on collision
  }
  return result;
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['key sub-pipeline (returns keyword)'],
  returns: 'Map<keyword, elem>',
  docs: ['Collapses a Vec into a Map keyed by the result of the key sub-pipeline. On collision (two elements producing the same key), the last element wins — last-wins is the standard convention for "at most one element per key, accept duplicates by overwriting". The key sub-pipeline must return a keyword for every element. Inverse of `vals` for the unique-key case.'],
  examples: [
    '[{:id :a :name "alice"} {:id :b :name "bob"}] | indexBy(/id) | /a/name → "alice"',
    '[{:id :a :v 1} {:id :a :v 2}] | indexBy(/id) | /a/v → 2'
  ],
  throws: ['IndexBySubjectNotVec', 'IndexByKeyNotKeyword']
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

// ── sortWith and comparator builders ──────────────────────────
//
// `sortWith` runs a custom comparator sub-pipeline against pairs of
// elements. The comparator receives a pair Map { :left a :right b }
// and returns a number: negative places left first, positive places
// right first, zero treats them as equal (preserving relative order
// per JS Array.sort stability).
//
// `asc` and `desc` are comparator builders that take a key
// sub-pipeline and produce a comparator. They accept any sub-pipeline
// for the key — bare projections (`/age`), computed expressions
// (`mul(/price, /qty)`), nested projections (`/profile/joinedAt`),
// or chains. The key sub-pipeline runs against /left and /right of
// the pair Map and the resulting key values are compared.
//
// `firstNonZero` is the composition primitive for compound
// comparators: pass it a Vec of comparator results and it returns
// the first non-zero (or 0 if all are zero), giving lexicographic
// tie-breaking semantics. Combined with a Vec literal, no dedicated
// "compose" operand is needed:
//
//   sortWith([asc(/lastName), desc(/age)] | firstNonZero)
//
// The Vec literal is itself a sub-pipeline; sortWith invokes the
// comparator lambda per pair, the Vec literal evaluates each element
// against the pair Map producing [n1, n2], and firstNonZero reduces
// to the first non-tie.

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
}, {
  category: 'vec-transformer',
  subject: 'Vec',
  modifiers: ['comparator-lambda (pair-Map → number)'],
  returns: 'Vec',
  docs: ['Sorts a Vec using a custom comparator sub-pipeline. The comparator receives a pair Map { :left a :right b } and must return a number: negative places left before right, positive places right before left, zero treats them as equal. Pair with asc/desc/firstNonZero for declarative comparators.'],
  examples: [
    '[3 1 2] | sortWith(sub(/left, /right))',
    'people | sortWith(asc(/age))',
    'nodes | sortWith([asc(/priority), desc(/timestamp)] | firstNonZero)'
  ],
  throws: ['SortWithSubjectNotVec', 'SortWithCmpResultNotNumber']
});

export const asc = higherOrderOp('asc', 2, (pair, keyLambda) => {
  if (!isQMap(pair)) throw new AscPairNotMap({
    actualType: describeType(pair),
    actualValue: pair
  });
  const left  = pair.get(keyword('left'));
  const right = pair.get(keyword('right'));
  const leftKey  = keyLambda(left);
  const rightKey = keyLambda(right);
  checkComparable(AscKeysNotComparable, leftKey, rightKey);
  return compareScalars(leftKey, rightKey);
}, {
  category: 'comparator',
  subject: 'pair Map { :left x :right y }',
  modifiers: ['key sub-pipeline'],
  returns: 'number (-1, 0, or 1)',
  docs: ['Builds an ascending comparator for sortWith. Applied per-pair, projects the key from /left and /right via the captured sub-pipeline and compares them in natural ascending order. The key sub-pipeline can be any expression — a bare projection (/age), a computed value (mul(/price, /qty)), or a multi-step pipeline.'],
  examples: [
    'sortWith(asc(/age))',
    'sortWith(asc(mul(/price, /qty)))',
    'sortWith(asc(/profile/joinedAt))'
  ],
  throws: ['AscPairNotMap', 'AscKeysNotComparable']
});

export const desc = higherOrderOp('desc', 2, (pair, keyLambda) => {
  if (!isQMap(pair)) throw new DescPairNotMap({
    actualType: describeType(pair),
    actualValue: pair
  });
  const left  = pair.get(keyword('left'));
  const right = pair.get(keyword('right'));
  const leftKey  = keyLambda(left);
  const rightKey = keyLambda(right);
  checkComparable(DescKeysNotComparable, leftKey, rightKey);
  return -compareScalars(leftKey, rightKey);
}, {
  category: 'comparator',
  subject: 'pair Map { :left x :right y }',
  modifiers: ['key sub-pipeline'],
  returns: 'number (-1, 0, or 1)',
  docs: ['Builds a descending comparator for sortWith. Same as asc but reverses the comparison so that higher key values come first.'],
  examples: [
    'sortWith(desc(/timestamp))',
    'sortWith(desc(/score))'
  ],
  throws: ['DescPairNotMap', 'DescKeysNotComparable']
});

// nullsFirst / nullsLast — comparator adapters that classify nil keys
// before delegating to an inner comparator for non-nil pairs. Without
// these, any sortWith pipeline over data containing nil-keyed elements
// throws AscKeysNotComparable / DescKeysNotComparable because nil is
// not a comparable scalar.
//
//   sortWith(nullsLast(asc(/age)))   — nil ages sort to the end
//   sortWith(nullsFirst(desc(/score))) — nil scores sort to the front

const NullsFirstPairNotMap = declareShapeError('NullsFirstPairNotMap',
  ({ actualType }) => `nullsFirst requires a pair Map subject ({ :left x :right y }), got ${actualType}`);
const NullsLastPairNotMap = declareShapeError('NullsLastPairNotMap',
  ({ actualType }) => `nullsLast requires a pair Map subject ({ :left x :right y }), got ${actualType}`);

// nullsComparator — extracts keys from the pair via keyLambda, checks
// for nil, and delegates to compareScalars for non-nil pairs. This
// operates at the key level (like asc/desc), not at the comparator
// wrapper level, because the nil resides in the projected key, not
// in the pair Map values themselves.
function nullsKeyComparator(pair, keyLambda, nilFirst, ascending, PairNotMapError) {
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
  checkComparable(nilFirst ? AscKeysNotComparable : DescKeysNotComparable, leftKey, rightKey);
  const cmp = compareScalars(leftKey, rightKey);
  return ascending ? cmp : -cmp;
}

export const nullsFirst = higherOrderOp('nullsFirst', 2, (pair, keyLambda) =>
  nullsKeyComparator(pair, keyLambda, true, true, NullsFirstPairNotMap), {
  category: 'comparator',
  subject: 'pair Map { :left x :right y }',
  modifiers: ['key sub-pipeline'],
  returns: 'number (-1, 0, or 1)',
  docs: ['Ascending comparator that places nil-keyed elements before all non-nil elements. Applied per-pair like asc, projects keys via the captured sub-pipeline, sorts nil keys to the front and non-nil keys in ascending order.'],
  examples: [
    'sortWith(nullsFirst(/age))',
    '[{:a 3} {:a nil} {:a 1}] | sortWith(nullsFirst(/a)) * /a → [nil 1 3]'
  ],
  throws: ['NullsFirstPairNotMap']
});

export const nullsLast = higherOrderOp('nullsLast', 2, (pair, keyLambda) =>
  nullsKeyComparator(pair, keyLambda, false, true, NullsLastPairNotMap), {
  category: 'comparator',
  subject: 'pair Map { :left x :right y }',
  modifiers: ['key sub-pipeline'],
  returns: 'number (-1, 0, or 1)',
  docs: ['Ascending comparator that places nil-keyed elements after all non-nil elements. Applied per-pair like asc, projects keys via the captured sub-pipeline, sorts nil keys to the end and non-nil keys in ascending order.'],
  examples: [
    'sortWith(nullsLast(/age))',
    '[{:a 3} {:a nil} {:a 1}] | sortWith(nullsLast(/a)) * /a → [1 3 nil]'
  ],
  throws: ['NullsLastPairNotMap']
});

export const firstNonZero = nullaryOp('firstNonZero', (vec) => {
  if (!isVec(vec)) throw new FirstNonZeroSubjectNotVec(describeType(vec), vec);
  for (let i = 0; i < vec.length; i++) {
    if (typeof vec[i] !== 'number') {
      throw new FirstNonZeroElementNotNumber(i, describeType(vec[i]), vec[i]);
    }
    if (vec[i] !== 0) return vec[i];
  }
  return 0;
}, {
  category: 'vec-reducer',
  subject: 'Vec of numbers',
  modifiers: [],
  returns: 'number',
  docs: ['Returns the first non-zero number in a Vec. If all elements are zero (or the Vec is empty), returns 0. The composition primitive for compound comparators in sortWith: each comparator returns -1/0/1, and firstNonZero picks the first non-tie, giving lexicographic ordering.'],
  examples: [
    '[0 0 -1 0] | firstNonZero → -1',
    '[0 0 0] | firstNonZero → 0',
    'sortWith([asc(/lastName), desc(/age)] | firstNonZero)'
  ],
  throws: ['FirstNonZeroSubjectNotVec', 'FirstNonZeroElementNotNumber']
});

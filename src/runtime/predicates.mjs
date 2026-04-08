// Predicates: subject-first comparisons and combinators.
//
// Equality (`eq`) uses the shared deepEqual from src/equality.mjs.
// Ordering (`gt`/`lt`/`gte`/`lte`) enforces matched comparable
// scalars; each operand owns its own ComparabilityError subclass
// so failures uniquely identify the call site.

import { valueOp, nullaryOp } from './dispatch.mjs';
import { isTruthy, describeType } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { declareComparabilityError } from './operand-errors.mjs';

const GtOperandsNotComparable  = declareComparabilityError('GtOperandsNotComparable',  'gt');
const LtOperandsNotComparable  = declareComparabilityError('LtOperandsNotComparable',  'lt');
const GteOperandsNotComparable = declareComparabilityError('GteOperandsNotComparable', 'gte');
const LteOperandsNotComparable = declareComparabilityError('LteOperandsNotComparable', 'lte');

function orderingCheck(ErrorCls, left, right) {
  const lt = describeType(left);
  const rt = describeType(right);
  const isScalar = (t) => t === 'number' || t === 'string';
  if (!isScalar(lt) || !isScalar(rt) || lt !== rt) {
    throw new ErrorCls(lt, rt);
  }
}

export const eq = valueOp('eq', 2, (subject, value) => deepEqual(subject, value), {
  category: 'predicate',
  subject: 'any',
  modifiers: ['any'],
  returns: 'boolean',
  docs: ['Returns true if subject equals the captured value by structural equality (deep recursive comparison across Maps, Vecs, Sets, scalars).'],
  examples: ['42 | eq(42) → true', '{:a 1} | eq({:a 1}) → true'],
  throws: []
});

export const gt = valueOp('gt', 2, (subject, threshold) => {
  orderingCheck(GtOperandsNotComparable, subject, threshold);
  return subject > threshold;
}, {
  category: 'predicate',
  subject: 'comparable scalar',
  modifiers: ['comparable scalar of same type'],
  returns: 'boolean',
  docs: ['Subject-first ordering: a | gt(b) computes a > b. Both operands must be comparable scalars of the same type.'],
  examples: ['10 | gt(5) → true'],
  throws: ['GtOperandsNotComparable']
});

export const lt = valueOp('lt', 2, (subject, threshold) => {
  orderingCheck(LtOperandsNotComparable, subject, threshold);
  return subject < threshold;
}, {
  category: 'predicate',
  subject: 'comparable scalar',
  modifiers: ['comparable scalar of same type'],
  returns: 'boolean',
  docs: ['Subject-first ordering: a | lt(b) computes a < b.'],
  examples: ['5 | lt(10) → true'],
  throws: ['LtOperandsNotComparable']
});

export const gte = valueOp('gte', 2, (subject, threshold) => {
  orderingCheck(GteOperandsNotComparable, subject, threshold);
  return subject >= threshold;
}, {
  category: 'predicate',
  subject: 'comparable scalar',
  modifiers: ['comparable scalar of same type'],
  returns: 'boolean',
  docs: ['Subject-first ordering: a | gte(b) computes a >= b.'],
  examples: ['10 | gte(10) → true'],
  throws: ['GteOperandsNotComparable']
});

export const lte = valueOp('lte', 2, (subject, threshold) => {
  orderingCheck(LteOperandsNotComparable, subject, threshold);
  return subject <= threshold;
}, {
  category: 'predicate',
  subject: 'comparable scalar',
  modifiers: ['comparable scalar of same type'],
  returns: 'boolean',
  docs: ['Subject-first ordering: a | lte(b) computes a <= b.'],
  examples: ['10 | lte(10) → true'],
  throws: ['LteOperandsNotComparable']
});

export const and = valueOp('and', 2, (a, b) => isTruthy(a) && isTruthy(b), {
  category: 'predicate',
  subject: 'any',
  modifiers: ['any'],
  returns: 'boolean',
  docs: ['Returns true if both operands are truthy. Used in full form inside compound predicates.'],
  examples: ['filter(and(/active, /age | gte(18)))'],
  throws: []
});

export const or = valueOp('or', 2, (a, b) => isTruthy(a) || isTruthy(b), {
  category: 'predicate',
  subject: 'any',
  modifiers: ['any'],
  returns: 'boolean',
  docs: ['Returns true if either operand is truthy.'],
  examples: ['filter(or(/vip, /score | gt(95)))'],
  throws: []
});

export const not = nullaryOp('not', (subject) => !isTruthy(subject), {
  category: 'predicate',
  subject: 'any',
  modifiers: [],
  returns: 'boolean',
  docs: ['Returns true if the subject is falsy (nil or false), false otherwise. 0, "", [], {}, #{} are all truthy.'],
  examples: ['nil | not → true', '0 | not → false'],
  throws: []
});

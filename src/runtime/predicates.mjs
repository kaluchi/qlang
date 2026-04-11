// Predicates: subject-first comparisons and combinators.
//
// Equality (`eq`) uses the shared deepEqual from src/equality.mjs.
// Ordering (`gt`/`lt`/`gte`/`lte`) enforces matched comparable
// scalars; each operand owns its own ComparabilityError subclass
// so failures uniquely identify the call site.
//
// Meta lives in lib/qlang/core.qlang.

import { valueOp, nullaryOp } from './dispatch.mjs';
import { isTruthy, describeType, keyword } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { declareComparabilityError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

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

export const eq = valueOp('eq', 2, (subject, value) => deepEqual(subject, value));

export const gt = valueOp('gt', 2, (subject, threshold) => {
  orderingCheck(GtOperandsNotComparable, subject, threshold);
  return subject > threshold;
});

export const lt = valueOp('lt', 2, (subject, threshold) => {
  orderingCheck(LtOperandsNotComparable, subject, threshold);
  return subject < threshold;
});

export const gte = valueOp('gte', 2, (subject, threshold) => {
  orderingCheck(GteOperandsNotComparable, subject, threshold);
  return subject >= threshold;
});

export const lte = valueOp('lte', 2, (subject, threshold) => {
  orderingCheck(LteOperandsNotComparable, subject, threshold);
  return subject <= threshold;
});

export const and = valueOp('and', 2, (a, b) => isTruthy(a) && isTruthy(b));

export const or = valueOp('or', 2, (a, b) => isTruthy(a) || isTruthy(b));

export const not = nullaryOp('not', (subject) => !isTruthy(subject));

// Variant-B primitive registry bindings — coexist with IMPLS.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/eq'),  eq);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/gt'),  gt);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/lt'),  lt);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/gte'), gte);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/lte'), lte);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/and'), and);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/or'),  or);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/not'), not);

// Predicates: subject-first comparisons, combinators, and
// type-classifier nullary operands.
//
// Equality (`eq`) uses the shared deepEqual from src/equality.mjs.
// Ordering (`gt`/`lt`/`gte`/`lte`) enforces matched comparable
// scalars; each operand owns its own ComparabilityError subclass
// so failures uniquely identify the call site.
//
// Type-classifier operands (`isString`, `isNumber`, `isVec`,
// `isMap`, `isSet`, `isKeyword`, `isBoolean`, `isNull`) wrap the
// corresponding predicates from types.mjs as operand-level nullary
// checks. They complement polymorphic `filter` / `every` / `any`
// over heterogeneous containers: `filter(byValue(isString))`
// lifts a type question to operand level without the descriptor-
// construction cost of `reify | /type | eq(:string)`.
//
// Meta lives in lib/qlang/core.qlang.

import { valueOp, nullaryOp } from './dispatch.mjs';
import {
  isTruthy, describeType, keyword,
  isString, isNumber, isVec, isQMap, isQSet, isKeyword, isBoolean, isNull
} from '../types.mjs';
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
  const isScalar = (t) => t === 'Number' || t === 'String';
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

// ── Type-classifier nullary operands ───────────────────────────
// Each wraps a types.mjs predicate as a qlang-level nullary. No
// per-site error — classification cannot fail, only answers true
// or false. The is-a-keyword / is-a-Map / is-a-Set dispatch table
// matches the describeType(v) inventory exactly.

export const isStringOp  = nullaryOp('isString',  (subject) => isString(subject));
export const isNumberOp  = nullaryOp('isNumber',  (subject) => isNumber(subject));
export const isVecOp     = nullaryOp('isVec',     (subject) => isVec(subject));
export const isMapOp     = nullaryOp('isMap',     (subject) => isQMap(subject));
export const isSetOp     = nullaryOp('isSet',     (subject) => isQSet(subject));
export const isKeywordOp = nullaryOp('isKeyword', (subject) => isKeyword(subject));
export const isBooleanOp = nullaryOp('isBoolean', (subject) => isBoolean(subject));
export const isNullOp    = nullaryOp('isNull',    (subject) => isNull(subject));

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/eq'),  eq);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/gt'),  gt);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/lt'),  lt);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/gte'), gte);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/lte'), lte);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/and'), and);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/or'),  or);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/not'), not);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isString'),  isStringOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isNumber'),  isNumberOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isVec'),     isVecOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isMap'),     isMapOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isSet'),     isSetOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isKeyword'), isKeywordOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isBoolean'), isBooleanOp);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isNull'),    isNullOp);

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
// over heterogeneous containers: `filter(isString)` over a Vec of
// mixed types, or `filter(isString)` over a Map to keep only
// String-valued entries. Lifts a type question to operand level
// without the descriptor-construction cost of
// `reify | /type | eq(:string)`.
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
// Every qlang value produces `true` from exactly one classifier.
// Each classifier asks `describeType` for a single label — the
// ladder in types.mjs is the single source of truth, so
// subtype-wrapping descriptors (Conduit, Snapshot) partition out
// of `isMap` without per-classifier layering here.

export const isString  = nullaryOp('isString',  (subject) => describeType(subject) === 'String');
export const isNumber  = nullaryOp('isNumber',  (subject) => describeType(subject) === 'Number');
export const isVec     = nullaryOp('isVec',     (subject) => describeType(subject) === 'Vec');
export const isMap     = nullaryOp('isMap',     (subject) => describeType(subject) === 'Map');
export const isSet     = nullaryOp('isSet',     (subject) => describeType(subject) === 'Set');
export const isKeyword = nullaryOp('isKeyword', (subject) => describeType(subject) === 'Keyword');
export const isBoolean = nullaryOp('isBoolean', (subject) => describeType(subject) === 'Boolean');
export const isNull    = nullaryOp('isNull',    (subject) => describeType(subject) === 'Null');

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/eq'),  eq);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/gt'),  gt);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/lt'),  lt);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/gte'), gte);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/lte'), lte);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/and'), and);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/or'),  or);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/not'), not);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isString'),  isString);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isNumber'),  isNumber);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isVec'),     isVec);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isMap'),     isMap);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isSet'),     isSet);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isKeyword'), isKeyword);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isBoolean'), isBoolean);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isNull'),    isNull);

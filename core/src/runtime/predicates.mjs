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
// `| type | eq(:string)`.
//
// Meta lives in lib/qlang/operand/predicate.qlang.

import { valueOp, nullaryOp } from './dispatch.mjs';
import { isTruthy, isKeyword as isKeywordValue, isTagKeyword as isTagKeywordValue, describeType, typeKeyword } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { declareComparabilityError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const GtOperandsNotComparableError  = declareComparabilityError('GtOperandsNotComparableError',  'gt');
const LtOperandsNotComparableError  = declareComparabilityError('LtOperandsNotComparableError',  'lt');
const GteOperandsNotComparableError = declareComparabilityError('GteOperandsNotComparableError', 'gte');
const LteOperandsNotComparableError = declareComparabilityError('LteOperandsNotComparableError', 'lte');

// orderingCheck + compareOrdering — ordering primitives for the
// gt/lt/gte/lte family. Mirror the contract used by sort/min/max
// in vec.mjs: matched-type pairings only (Number↔Number, String↔
// String, Keyword↔Keyword, TagKeyword↔TagKeyword); identifier
// pairs compare lexicographically by `.name` — the same axis that
// drives sort over a keyword Vec / Set.
function orderingCheck(ErrorCls, left, right) {
  const bothNumbers     = typeof left === 'number' && typeof right === 'number';
  const bothStrings     = typeof left === 'string' && typeof right === 'string';
  const bothKeywords    = isKeywordValue(left)    && isKeywordValue(right);
  const bothTagKeywords = isTagKeywordValue(left) && isTagKeywordValue(right);
  if (!bothNumbers && !bothStrings && !bothKeywords && !bothTagKeywords) {
    throw new ErrorCls(left, right);
  }
}

function compareOrdering(left, right) {
  if (isKeywordValue(left) || isTagKeywordValue(left)) {
    if (left.name < right.name) return -1;
    if (left.name > right.name) return 1;
    return 0;
  }
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export const eq = valueOp('eq', 2, (subject, value) => deepEqual(subject, value));

export const gt = valueOp('gt', 2, (subject, threshold) => {
  orderingCheck(GtOperandsNotComparableError, subject, threshold);
  return compareOrdering(subject, threshold) > 0;
});

export const lt = valueOp('lt', 2, (subject, threshold) => {
  orderingCheck(LtOperandsNotComparableError, subject, threshold);
  return compareOrdering(subject, threshold) < 0;
});

export const gte = valueOp('gte', 2, (subject, threshold) => {
  orderingCheck(GteOperandsNotComparableError, subject, threshold);
  return compareOrdering(subject, threshold) >= 0;
});

export const lte = valueOp('lte', 2, (subject, threshold) => {
  orderingCheck(LteOperandsNotComparableError, subject, threshold);
  return compareOrdering(subject, threshold) <= 0;
});

export const and = valueOp('and', 2, (a, b) => isTruthy(a) && isTruthy(b));

export const or = valueOp('or', 2, (a, b) => isTruthy(a) || isTruthy(b));

export const not = nullaryOp('not', (subject) => !isTruthy(subject));

// `type` — pipeline-time axis on value identity. Returns the
// TagKeyword for tagged values (errors, conduits, snapshots,
// tagged-instances) and the plain Keyword for scalars and base
// containers. The single user-facing path to a value's identity
// tag — symmetric to how `:foo | source` / `| docs` / `| examples`
// are the user-facing path to binding-namespace metadata.
// Error-track handling reads as `result !| type | eq(::Foo)`.
export const type = nullaryOp('type', (subject) => typeKeyword(subject));

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
export const isTag     = nullaryOp('isTag',     (subject) => describeType(subject) === 'TagKeyword');
export const isBoolean = nullaryOp('isBoolean', (subject) => describeType(subject) === 'Boolean');
export const isNull    = nullaryOp('isNull',    (subject) => describeType(subject) === 'Null');
export const isQuote      = nullaryOp('isQuote',      (subject) => describeType(subject) === 'Quote');
export const isDoc        = nullaryOp('isDoc',        (subject) => describeType(subject) === 'Doc');
export const isJsonObject = nullaryOp('isJsonObject', (subject) => describeType(subject) === 'JsonObject');
export const isJsonArray  = nullaryOp('isJsonArray',  (subject) => describeType(subject) === 'JsonArray');

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('eq',  eq);
bindPrim('gt',  gt);
bindPrim('lt',  lt);
bindPrim('gte', gte);
bindPrim('lte', lte);
bindPrim('and', and);
bindPrim('or',  or);
bindPrim('not', not);
bindPrim('type', type);
bindPrim('isString',  isString);
bindPrim('isNumber',  isNumber);
bindPrim('isVec',     isVec);
bindPrim('isMap',     isMap);
bindPrim('isSet',     isSet);
bindPrim('isKeyword', isKeyword);
bindPrim('isTag',     isTag);
bindPrim('isBoolean', isBoolean);
bindPrim('isNull',    isNull);
bindPrim('isQuote',      isQuote);
bindPrim('isDoc',        isDoc);
bindPrim('isJsonObject', isJsonObject);
bindPrim('isJsonArray',  isJsonArray);

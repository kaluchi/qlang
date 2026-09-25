// Predicates: subject-first comparisons, combinators, and the
// identity-tag reader.
//
// Equality (`eq`) uses the shared deepEqual from src/equality.mjs.
// Ordering (`gt`/`lt`/`gte`/`lte`) enforces matched comparable
// scalars; each operand owns its own ComparabilityError subclass
// so failures uniquely identify the call site.
//
// `type` answers a value's identity tag, and asking what a value
// is means composing that reader with `eq`: `filter ~(type |
// eq :string)` over a Vec of mixed types, or over a Map to keep
// the String-valued entries. Identity rides the JS-header slot, so
// a tagged value answers its `::Tag` and its shape reads through
// `payload`.
//
// Meta lives in lib/qlang/operand/predicate.qlang, and `type`'s in
// lib/qlang/operand/typeClassifier.qlang.

import { valueOp, nullaryOp } from './dispatch.mjs';
import { isTruthy, typeKeyword } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { checkComparable, compareValues } from '../ordering.mjs';
import { declareComparabilityError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const GtOperandsNotComparableError  = declareComparabilityError('GtOperandsNotComparableError',  'gt');
const LtOperandsNotComparableError  = declareComparabilityError('LtOperandsNotComparableError',  'lt');
const GteOperandsNotComparableError = declareComparabilityError('GteOperandsNotComparableError', 'gte');
const LteOperandsNotComparableError = declareComparabilityError('LteOperandsNotComparableError', 'lte');

export const eq = valueOp('eq', 2, (subject, value) => deepEqual(subject, value));

export const gt = valueOp('gt', 2, (subject, threshold) => {
  checkComparable(GtOperandsNotComparableError, subject, threshold);
  return compareValues(subject, threshold) > 0;
});

export const lt = valueOp('lt', 2, (subject, threshold) => {
  checkComparable(LtOperandsNotComparableError, subject, threshold);
  return compareValues(subject, threshold) < 0;
});

export const gte = valueOp('gte', 2, (subject, threshold) => {
  checkComparable(GteOperandsNotComparableError, subject, threshold);
  return compareValues(subject, threshold) >= 0;
});

export const lte = valueOp('lte', 2, (subject, threshold) => {
  checkComparable(LteOperandsNotComparableError, subject, threshold);
  return compareValues(subject, threshold) <= 0;
});

export const and = valueOp('and', 2, (a, b) => isTruthy(a) && isTruthy(b));

export const or = valueOp('or', 2, (a, b) => isTruthy(a) || isTruthy(b));

export const not = nullaryOp('not', (subject) => !isTruthy(subject));

// `type` — pipeline-time axis on value identity. Returns the kind
// of the value, a TagKeyword: the tag of a tagged value (errors,
// conduits, snapshots, tagged-instances), and the kind of the core
// its literal implies for every other [D32]. The single user-facing
// path to a value's identity
// tag — symmetric to how `:foo | source` / `| docs` / `| examples`
// are the user-facing path to binding-namespace metadata.
// Error-track handling reads as `result !| type | eq ::Foo`.
export const type = nullaryOp('type', (subject) => typeKeyword(subject));


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

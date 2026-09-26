// Predicates: subject-first comparisons, combinators, and the
// identity-tag reader.
//
// Equality (`eq`) uses the shared deepEqual from src/equality.mjs.
// Ordering (`gt`/`lt`/`gte`/`lte`) is one primitive each, a plain
// function over two values of one kind, which the head of each of its
// residences checked [D65], [D72].
//
// `type` answers a value's identity tag, and asking what a value
// is means composing that reader with `eq`: `filter ~(type |
// eq :string)` over a Vec of mixed types, or over a Map to keep
// the String-valued entries. Identity rides the JS-header slot, so
// a tagged value answers its `::Tag` and its shape reads through
// `payload`.
//
// Meta lives in lib/qlang/operand/predicate.qlang, `type`'s in
// lib/qlang/operand/typeClassifier.qlang, and the comparisons' in the
// modules of the kinds they compare and their contracts'
// lib/qlang/any.qlang.

import { valueOp, nullaryOp } from './dispatch.mjs';
import { typeKeyword } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { compareValues } from '../ordering.mjs';
import { declareModifierError, declareSubjectError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

// The combinators of conditions take booleans [D14].
const AndLeftNotBooleanError    = declareModifierError('AndLeftNotBooleanError',  'and', 1, 'boolean');
const AndRightNotBooleanError   = declareModifierError('AndRightNotBooleanError', 'and', 2, 'boolean');
const OrLeftNotBooleanError     = declareModifierError('OrLeftNotBooleanError',   'or',  1, 'boolean');
const OrRightNotBooleanError    = declareModifierError('OrRightNotBooleanError',  'or',  2, 'boolean');
const NotSubjectNotBooleanError = declareSubjectError('NotSubjectNotBooleanError', 'not', 'boolean');

export const eq = valueOp('eq', 2, (subject, value) => deepEqual(subject, value));


export const and = valueOp('and', 2, (left, right) => {
  if (typeof left !== 'boolean') throw new AndLeftNotBooleanError(left);
  if (typeof right !== 'boolean') throw new AndRightNotBooleanError(right);
  return left && right;
});

export const or = valueOp('or', 2, (left, right) => {
  if (typeof left !== 'boolean') throw new OrLeftNotBooleanError(left);
  if (typeof right !== 'boolean') throw new OrRightNotBooleanError(right);
  return left || right;
});

export const not = nullaryOp('not', (subject) => {
  if (typeof subject !== 'boolean') throw new NotSubjectNotBooleanError(subject);
  return !subject;
});

// `type` — pipeline-time axis on value identity. Returns the kind
// of the value, a TagKeyword: the tag of a tagged value (errors,
// verbs, binding records, tagged-instances), and the kind of the core
// its literal implies for every other [D32]. The single user-facing
// path to a value's identity
// tag — symmetric to how `:foo | source` / `| docs` / `| examples`
// are the user-facing path to binding-namespace metadata.
// Error-track handling reads as `result !| type | eq ::Foo`.
export const type = nullaryOp('type', (subject) => typeKeyword(subject));


// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('eq',  eq);
bindPrim('gt',  (subject, than) => compareValues(subject, than) > 0);
bindPrim('lt',  (subject, than) => compareValues(subject, than) < 0);
bindPrim('gte', (subject, than) => compareValues(subject, than) >= 0);
bindPrim('lte', (subject, than) => compareValues(subject, than) <= 0);
bindPrim('and', and);
bindPrim('or',  or);
bindPrim('not', not);
bindPrim('type', type);

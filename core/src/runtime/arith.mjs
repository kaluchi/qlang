// Arithmetic operands.
//
// Subject-first: position 1 is the subject, position 2 is the
// modifier. Each type check is inlined at its own throw site so
// the source file and line number plus the class name together
// uniquely identify the failing check.
//
// Meta lives in lib/qlang/operand/arith.qlang.

import { valueOp } from './dispatch.mjs';
import { declareNumericDomainError } from '../errors.mjs';

// `div` refuses two magnitudes: a zero divisor, and a quotient past
// the finite-double range. Both are the same repair for a reader —
// change a value — so both ride `NumericDomainError`.
export const DivisionByZeroError = declareNumericDomainError(
  'DivisionByZeroError', () => 'division by zero', { operand: 'div' }
);
import { declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const AddLeftNotNumberError  = declareModifierError('AddLeftNotNumberError',  'add', 1, 'number');
const AddRightNotNumberError = declareModifierError('AddRightNotNumberError', 'add', 2, 'number');
const SubLeftNotNumberError  = declareModifierError('SubLeftNotNumberError',  'sub', 1, 'number');
const SubRightNotNumberError = declareModifierError('SubRightNotNumberError', 'sub', 2, 'number');
const MulLeftNotNumberError  = declareModifierError('MulLeftNotNumberError',  'mul', 1, 'number');
const MulRightNotNumberError = declareModifierError('MulRightNotNumberError', 'mul', 2, 'number');
const DivLeftNotNumberError  = declareModifierError('DivLeftNotNumberError',  'div', 1, 'number');
const DivRightNotNumberError = declareModifierError('DivRightNotNumberError', 'div', 2, 'number');

// A qlang Number is a finite double (see `### number` in
// qlang-spec.md). Both operands are finite by that same rule, so
// the operation itself is the only way out of the domain, and each
// site lifts its own class onto the fail-track — the second answer
// `div` gives alongside `DivisionByZeroError`.
const AddResultNotFiniteError = declareNumericDomainError('AddResultNotFiniteError',
  ({ leftValue, rightValue }) => `add(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'add' }
);
const SubResultNotFiniteError = declareNumericDomainError('SubResultNotFiniteError',
  ({ leftValue, rightValue }) => `sub(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'sub' }
);
const MulResultNotFiniteError = declareNumericDomainError('MulResultNotFiniteError',
  ({ leftValue, rightValue }) => `mul(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'mul' }
);
const DivResultNotFiniteError = declareNumericDomainError('DivResultNotFiniteError',
  ({ leftValue, rightValue }) => `div(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'div' }
);

// The operands ride the descriptor as `:leftValue` / `:rightValue`
// — both finite, so the error value itself stays renderable, where
// stamping the overflowed result would plant the very shape this
// site refuses.
function finiteOrLift(arithResult, leftValue, rightValue, ErrorCls) {
  if (!Number.isFinite(arithResult)) throw new ErrorCls({ leftValue, rightValue });
  return arithResult;
}

export const add = valueOp('add', 2, (a, b) => {
  if (typeof a !== 'number') throw new AddLeftNotNumberError(a);
  if (typeof b !== 'number') throw new AddRightNotNumberError(b);
  return finiteOrLift(a + b, a, b, AddResultNotFiniteError);
});

export const sub = valueOp('sub', 2, (a, b) => {
  if (typeof a !== 'number') throw new SubLeftNotNumberError(a);
  if (typeof b !== 'number') throw new SubRightNotNumberError(b);
  return finiteOrLift(a - b, a, b, SubResultNotFiniteError);
});

export const mul = valueOp('mul', 2, (a, b) => {
  if (typeof a !== 'number') throw new MulLeftNotNumberError(a);
  if (typeof b !== 'number') throw new MulRightNotNumberError(b);
  return finiteOrLift(a * b, a, b, MulResultNotFiniteError);
});

export const div = valueOp('div', 2, (a, b) => {
  if (typeof a !== 'number') throw new DivLeftNotNumberError(a);
  if (typeof b !== 'number') throw new DivRightNotNumberError(b);
  if (b === 0) throw new DivisionByZeroError();
  return finiteOrLift(a / b, a, b, DivResultNotFiniteError);
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('add', add);
bindPrim('sub', sub);
bindPrim('mul', mul);
bindPrim('div', div);

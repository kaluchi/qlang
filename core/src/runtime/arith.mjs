// Arithmetic primitives, each a plain function over the numbers the head
// of its verb checked [D72]. The head raises the refusals of the subject
// and of the slot, declared here at the place each guards, position 1
// the subject and position 2 the slot; the primitive raises the
// refusals of the magnitude.
//
// The verbs live in lib/qlang/number.qlang.

import { declareNumericDomainError } from '../errors.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

// `div` refuses two magnitudes: a zero divisor, and a quotient past
// the finite-double range. Both are the same repair for a reader —
// change a value — so both ride `NumericDomainError`.
export const DivisionByZeroError = declareNumericDomainError(
  'number/DivisionByZeroError', () => 'division by zero', { operand: 'div' }
);

declareModifierError('number/AddLeftNotNumberError',  'add', 1, 'number');
declareModifierError('number/AddRightNotNumberError', 'add', 2, 'number');
declareModifierError('number/SubLeftNotNumberError',  'sub', 1, 'number');
declareModifierError('number/SubRightNotNumberError', 'sub', 2, 'number');
declareModifierError('number/MulLeftNotNumberError',  'mul', 1, 'number');
declareModifierError('number/MulRightNotNumberError', 'mul', 2, 'number');
declareModifierError('number/DivLeftNotNumberError',  'div', 1, 'number');
declareModifierError('number/DivRightNotNumberError', 'div', 2, 'number');
declareModifierError('number/RoundSubjectNotNumberError', 'round', 1, 'number');
const RoundDigitsNotIntegerError = declareModifierError('number/RoundDigitsNotIntegerError', 'round', 2, 'integer');

// A qlang Number is a finite double, as the page of `::number` says.
// Both operands are finite by that same rule, so
// the operation itself is the only way out of the domain, and each
// site lifts its own class onto the fail-track — the second answer
// `div` gives alongside `DivisionByZeroError`.
const AddResultNotFiniteError = declareNumericDomainError('number/AddResultNotFiniteError',
  ({ leftValue, rightValue }) => `add(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'add' }
);
const SubResultNotFiniteError = declareNumericDomainError('number/SubResultNotFiniteError',
  ({ leftValue, rightValue }) => `sub(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'sub' }
);
const MulResultNotFiniteError = declareNumericDomainError('number/MulResultNotFiniteError',
  ({ leftValue, rightValue }) => `mul(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'mul' }
);
const DivResultNotFiniteError = declareNumericDomainError('number/DivResultNotFiniteError',
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

bindPrim('number/add', (augend, addend) => finiteOrLift(augend + addend, augend, addend, AddResultNotFiniteError));
bindPrim('number/sub', (minuend, subtrahend) => finiteOrLift(minuend - subtrahend, minuend, subtrahend, SubResultNotFiniteError));
bindPrim('number/mul', (multiplicand, multiplier) =>
  finiteOrLift(multiplicand * multiplier, multiplicand, multiplier, MulResultNotFiniteError));
bindPrim('number/div', (dividend, divisor) => {
  if (divisor === 0) throw new DivisionByZeroError();
  return finiteOrLift(dividend / divisor, dividend, divisor, DivResultNotFiniteError);
});

// A number rounds half away from zero to the digits after the point the
// call gives, a negative count rounding to tens and beyond [D132].
bindPrim('number/round', (subject, digits) => {
  if (!Number.isInteger(digits)) throw new RoundDigitsNotIntegerError(digits);
  const factor = 10 ** digits;
  const rounded = Math.sign(subject) * Math.round((Math.abs(subject) + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
});

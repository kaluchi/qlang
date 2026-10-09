// Arithmetic primitives, each a plain function over the number the walk
// served and the parts of the object its call gives [D164]. The laws of
// the parts hold their kinds before a primitive runs [D166]; a primitive
// raises the refusals of the magnitude, declared under the name it
// serves.
//
// The names live in lib/qlang/number.qlang.

import { declareNumericDomainError, declareShapeError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { typeKeyword } from '../types.mjs';

// `div` refuses two magnitudes: a zero divisor, and a quotient past
// the finite-double range. Both are the same repair for a reader —
// change a value — so both ride `NumericDomainError`.
export const NumberDivByZeroError = declareNumericDomainError(
  'number/div/ByZeroError', () => 'division by zero', { operand: 'div' }
);

const NumberRoundDigitsNotIntegerError = declareShapeError('number/round/DigitsNotIntegerError',
  ({ actualValue }) => `round takes a whole number of digits, got ${actualValue}`,
  { operand: 'round', expectedType: 'integer' }
);

// A qlang Number is a finite double, as the page of `::number` says.
// Both operands are finite by that same rule, so
// the operation itself is the only way out of the domain, and each
// site lifts its own class onto the fail-track — the second answer
// `div` gives alongside `ByZeroError`.
const NumberAddResultNotFiniteError = declareNumericDomainError('number/add/ResultNotFiniteError',
  ({ leftValue, rightValue }) => `add(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'add' }
);
const NumberSubResultNotFiniteError = declareNumericDomainError('number/sub/ResultNotFiniteError',
  ({ leftValue, rightValue }) => `sub(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'sub' }
);
const NumberMulResultNotFiniteError = declareNumericDomainError('number/mul/ResultNotFiniteError',
  ({ leftValue, rightValue }) => `mul(${leftValue}, ${rightValue}) leaves the finite double range`,
  { operand: 'mul' }
);
const NumberDivResultNotFiniteError = declareNumericDomainError('number/div/ResultNotFiniteError',
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

bindPrim('number/add', (augend, addend) => finiteOrLift(augend + addend, augend, addend, NumberAddResultNotFiniteError));
bindPrim('number/sub', (minuend, subtrahend) => finiteOrLift(minuend - subtrahend, minuend, subtrahend, NumberSubResultNotFiniteError));
bindPrim('number/mul', (multiplicand, multiplier) =>
  finiteOrLift(multiplicand * multiplier, multiplicand, multiplier, NumberMulResultNotFiniteError));
bindPrim('number/div', (dividend, divisor) => {
  if (divisor === 0) throw new NumberDivByZeroError();
  return finiteOrLift(dividend / divisor, dividend, divisor, NumberDivResultNotFiniteError);
});

// A number rounds half away from zero to the digits after the point the
// call gives, a negative count rounding to tens and beyond [D132].
bindPrim('number/round', (subject, digits) => {
  if (!Number.isInteger(digits)) throw new NumberRoundDigitsNotIntegerError({ actualValue: digits, actualType: typeKeyword(digits) });
  const factor = 10 ** digits;
  const rounded = Math.sign(subject) * Math.round((Math.abs(subject) + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
});

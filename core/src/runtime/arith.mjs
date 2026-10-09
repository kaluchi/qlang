// Arithmetic primitives, each a plain function over the number the walk
// served and the parts of the object its call gives [D164]. The laws of
// the parts hold their kinds before a primitive runs [D166], and an
// answer that left the finite doubles is refused as it is brought under
// `::number` [D169]; `div` refuses a zero divisor itself.
//
// The names live in lib/qlang/number.qlang.

import { declareNumericDomainError, declareShapeError } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { typeKeyword } from '../types.mjs';

export const NumberDivByZeroError = declareNumericDomainError(
  'number/div/ByZeroError', () => 'division by zero', { operand: 'div' }
);

const NumberRoundDigitsNotIntegerError = declareShapeError('number/round/DigitsNotIntegerError',
  ({ actualValue }) => `round takes a whole number of digits, got ${actualValue}`,
  { operand: 'round', expectedType: 'integer' }
);

bindPrim('number/add', (augend, addend) => augend + addend);
bindPrim('number/sub', (minuend, subtrahend) => minuend - subtrahend);
bindPrim('number/mul', (multiplicand, multiplier) => multiplicand * multiplier);
bindPrim('number/div', (dividend, divisor) => {
  if (divisor === 0) throw new NumberDivByZeroError();
  return dividend / divisor;
});

// A number rounds half away from zero to the digits after the point the
// call gives, a negative count rounding to tens and beyond [D132].
bindPrim('number/round', (subject, digits) => {
  if (!Number.isInteger(digits)) throw new NumberRoundDigitsNotIntegerError({ actualValue: digits, actualType: typeKeyword(digits) });
  const factor = 10 ** digits;
  const rounded = Math.sign(subject) * Math.round((Math.abs(subject) + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
});

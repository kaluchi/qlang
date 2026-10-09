// Arithmetic primitives, each a plain function over the number the walk
// served and the parts of the object its call gives [D164]. The laws of
// the parts hold before a primitive runs, a divisor no zero among them
// [D166], [D172], and an answer that left the finite doubles is refused
// as it is brought under `::number` [D169].
//
// The names live in lib/qlang/number.qlang.

import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
// The digits of `round` are a whole number; the law `eq (round)` that
// states it for a count would call `round` again on its own digits.
const NumberRoundDigitsNotIntegerError = declareRefusal('number/round/DigitsNotIntegerError');

bindPrim('number/add', (augend, addend) => augend + addend);
bindPrim('number/sub', (minuend, subtrahend) => minuend - subtrahend);
bindPrim('number/mul', (multiplicand, multiplier) => multiplicand * multiplier);
bindPrim('number/div', (dividend, divisor) => dividend / divisor);

// A number rounds half away from zero to the digits after the point the
// call gives, a negative count rounding to tens and beyond [D132].
bindPrim('number/round', (subject, digits) => {
  if (!Number.isInteger(digits)) throw new NumberRoundDigitsNotIntegerError({ actualValue: digits });
  const factor = 10 ** digits;
  const rounded = Math.sign(subject) * Math.round((Math.abs(subject) + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
});

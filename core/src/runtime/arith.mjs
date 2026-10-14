// Arithmetic primitives, each a plain function over the number the walk
// served and the inputs its call reads [D251]. The invariants of the
// inputs hold before a primitive runs, a divisor no zero among them
// [D46], [D251], and an answer that left the finite doubles is refused
// as it is brought under `::number` [D169].
//
// The names live in lib/qlang/number.qlang.

import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';
const NumberRangeCountNotIntegerError = declareRefusal('number/range/CountNotIntegerError');
const NumberRangeCountTooLargeError = declareRefusal('number/range/CountTooLargeError');

bindPrim('number/add', (augend, addend) => augend + addend);
bindPrim('number/sub', (minuend, subtrahend) => minuend - subtrahend);
bindPrim('number/mul', (multiplicand, multiplier) => multiplicand * multiplier);
bindPrim('number/div', (dividend, divisor) => dividend / divisor);

// The remainder takes the sign of the divisor, the floored remainder
// [D194]; a zero answer is no negative zero.
const unsignedZero = number => (number === 0 ? 0 : number);
bindPrim('number/mod', (dividend, divisor) => unsignedZero(dividend - divisor * Math.floor(dividend / divisor)));
bindPrim('number/abs', subject => Math.abs(subject));
bindPrim('number/floor', subject => Math.floor(subject));
bindPrim('number/ceil', subject => unsignedZero(Math.ceil(subject)));

// The whole numbers from zero below a whole count [D194], a count no
// longer than the length a JavaScript array may have.
const LONGEST_VECTOR = 2 ** 32 - 1;
bindPrim('number/range', count => {
  if (!Number.isInteger(count)) throw new NumberRangeCountNotIntegerError({ actualValue: count });
  if (count > LONGEST_VECTOR) throw new NumberRangeCountTooLargeError({ longest: LONGEST_VECTOR, actualValue: count });
  return Array.from({ length: Math.max(count, 0) }, (_, index) => index);
});

// A number rounds half away from zero to the digits after the point the
// call gives, a whole number its part holds [D46], a negative count
// rounding to tens and beyond [D132].
bindPrim('number/round', (subject, digits) => {
  const factor = 10 ** digits;
  const rounded = Math.sign(subject) * Math.round((Math.abs(subject) + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
});

// Arithmetic primitives, each a plain function over the number the walk served
// and the inputs its call reads [QSBLD#fn]. The invariants of the inputs hold
// before a primitive runs, a divisor no zero among them [QSERR#site],
// [QSBLD#fn], and an answer that left the finite doubles is refused as it is
// brought under `::number` [QSSLF#catalog].
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

// The remainder takes the sign of the divisor, the floored remainder, read
// from the remainder of the doubles so no quotient leaves their range
// [QSNUM#arithmetic]; a zero answer is no negative zero.
const unsignedZero = number => (number === 0 ? 0 : number);
bindPrim('number/mod', (dividend, divisor) => {
  const remainder = dividend % divisor;
  return unsignedZero(remainder !== 0 && Math.sign(remainder) !== Math.sign(divisor) ? remainder + divisor : remainder);
});
bindPrim('number/abs', subject => Math.abs(subject));
bindPrim('number/floor', subject => Math.floor(subject));
bindPrim('number/ceil', subject => unsignedZero(Math.ceil(subject)));

// The whole numbers from zero below a whole count [QSNUM#arithmetic], a count no
// longer than the length a JavaScript array may have.
const LONGEST_VECTOR = 2 ** 32 - 1;
bindPrim('number/range', count => {
  if (!Number.isInteger(count)) throw new NumberRangeCountNotIntegerError({ actualValue: count });
  if (count > LONGEST_VECTOR) throw new NumberRangeCountTooLargeError({ longest: LONGEST_VECTOR, actualValue: count });
  return Array.from({ length: Math.max(count, 0) }, (_, index) => index);
});

// A number rounds half away from zero to the digits after the point the
// call gives, read as its digits are written, a whole number its part holds
// [QSERR#site], a negative count rounding to tens and beyond [D303]; digits
// past what a double holds leave the number as it is, and tens past it
// round to zero.
bindPrim('number/round', (subject, digits) => {
  const shifted = shiftedBy(Math.abs(subject), digits);
  if (!Number.isFinite(shifted)) return subject;
  const rounded = Math.sign(subject) * shiftedBy(Math.round(shifted), -digits);
  return rounded === 0 ? 0 : rounded;
});

// A number with its point moved by a count of places, read from the
// digits that write it.
function shiftedBy(number, places) {
  const [digits, exponent = '0'] = String(number).split('e');
  return Number(`${digits}e${Number(exponent) + places}`);
}

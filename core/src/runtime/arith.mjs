// Arithmetic primitives, each taking the values alone, the number the walk
// served and the inputs its call reads [QSHST#source]. The invariants of a call
// hold before a primitive runs, a divisor no zero and the count of `range` whole
// [QSERR#site], [QSBLD#fn], and an answer that left the finite doubles is refused
// as it is brought under `::number` [QSNUM#arithmetic].

import { declareRefusal } from '../errors.mjs';
import { registerPrimitive } from '../primitives.mjs';
const NumberRangeCountTooLargeError = declareRefusal('number/range/CountTooLargeError');

registerPrimitive('number/add', (augend, addend) => augend + addend);
registerPrimitive('number/sub', (minuend, subtrahend) => minuend - subtrahend);
registerPrimitive('number/mul', (multiplicand, multiplier) => multiplicand * multiplier);
registerPrimitive('number/div', (dividend, divisor) => dividend / divisor);

// The remainder takes the sign of the divisor, the floored remainder, read
// from the remainder of the doubles so no quotient leaves their range
// [QSNUM#arithmetic]; a zero answer is no negative zero.
const unsignedZero = number => (number === 0 ? 0 : number);
registerPrimitive('number/mod', (dividend, divisor) => {
  const remainder = dividend % divisor;
  return unsignedZero(remainder !== 0 && Math.sign(remainder) !== Math.sign(divisor) ? remainder + divisor : remainder);
});
registerPrimitive('number/abs', subject => Math.abs(subject));
registerPrimitive('number/floor', subject => Math.floor(subject));
registerPrimitive('number/ceil', subject => unsignedZero(Math.ceil(subject)));

// The whole numbers from zero below a whole count [QSNUM#arithmetic], a count no
// longer than the length a JavaScript array may have.
const LONGEST_VECTOR = 2 ** 32 - 1;
registerPrimitive('number/range', count => {
  if (count > LONGEST_VECTOR) throw new NumberRangeCountTooLargeError({ longest: LONGEST_VECTOR, actualValue: count });
  return Array.from({ length: Math.max(count, 0) }, (_, index) => index);
});

// A number rounds half away from zero to the digits the call gives, a whole
// number [QSERR#site], as its digits are written, a negative count to tens and
// beyond [QSNUM#arithmetic]; past a double it stays, and tens past it give zero.
registerPrimitive('number/round', (subject, digits) => {
  const shifted = shiftedBy(Math.abs(subject), digits);
  if (!Number.isFinite(shifted)) return subject;
  const rounded = Math.sign(subject) * shiftedBy(Math.round(shifted), -digits);
  return rounded === 0 ? 0 : rounded;
});

// A number with its point moved by places, read from the digits that write it.
function shiftedBy(number, places) {
  const [digits, exponent = '0'] = String(number).split('e');
  return Number(`${digits}e${Number(exponent) + places}`);
}

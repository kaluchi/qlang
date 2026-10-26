// [QSHST#source], [QSERR#site], [QSBLD#fn], [QSNUM#arithmetic]

import { declareRefusal } from '../errors.mjs';
import { registerPrimitive, asCombiner } from '../primitives.mjs';
const NumberRangeCountTooLargeError = declareRefusal('number/range/CountTooLargeError');

registerPrimitive('number/add', asCombiner((augend, addend) => augend + addend));
registerPrimitive('number/sub', asCombiner((minuend, subtrahend) => minuend - subtrahend));
registerPrimitive('number/mul', asCombiner((multiplicand, multiplier) => multiplicand * multiplier));
registerPrimitive('number/div', asCombiner((dividend, divisor) => dividend / divisor));

// [QSNUM#arithmetic]
const unsignedZero = number => (number === 0 ? 0 : number);
registerPrimitive('number/mod', asCombiner((dividend, divisor) => {
  const remainder = dividend % divisor;
  return unsignedZero(remainder !== 0 && Math.sign(remainder) !== Math.sign(divisor) ? remainder + divisor : remainder);
}));
registerPrimitive('number/abs', subject => Math.abs(subject));
registerPrimitive('number/floor', subject => Math.floor(subject));
registerPrimitive('number/ceil', subject => unsignedZero(Math.ceil(subject)));

const LONGEST_VECTOR = 2 ** 32 - 1;
registerPrimitive('number/range', count => {
  if (count > LONGEST_VECTOR) throw new NumberRangeCountTooLargeError({ longest: LONGEST_VECTOR });
  return Array.from({ length: Math.max(count, 0) }, (_, index) => index);
});

// [QSERR#site], [QSNUM#arithmetic]
registerPrimitive('number/round', (subject, digits) => {
  const shifted = shiftedBy(Math.abs(subject), digits);
  if (!Number.isFinite(shifted)) return subject;
  const rounded = Math.sign(subject) * shiftedBy(Math.round(shifted), -digits);
  return rounded === 0 ? 0 : rounded;
});

function shiftedBy(number, by) {
  const [digits, exponent = '0'] = String(number).split('e');
  return Number(`${digits}e${Number(exponent) + by}`);
}

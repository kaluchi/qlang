// [QSNUM#combine], [QSCOL#algebra]

import { beneathTags, isErrorValue, isMap, isNumber, isSet, pairRefused, TagsInCommon } from '../types.mjs';
import { kindsExpected } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { registerStateReader, runsAsCode, takesAsGiven } from '../primitives.mjs';
import { underSharedTags } from '../eval.mjs';
import { unitedOf } from './setops.mjs';

const AnySumOfNumbersAnswerKindNotTakenError = declareRefusal('any/sumOf/NumbersAnswerKindNotTakenError');
const AnyMulOfFactorsAnswerKindNotTakenError = declareRefusal('any/mulOf/FactorsAnswerKindNotTakenError');
const AnySubOfMinuendAnswerKindNotTakenError = declareRefusal('any/subOf/MinuendAnswerKindNotTakenError');
const AnySubOfSubtrahendAnswerKindNotTakenError = declareRefusal('any/subOf/SubtrahendAnswerKindNotTakenError');
const AnyDivOfDividendAnswerKindNotTakenError = declareRefusal('any/divOf/DividendAnswerKindNotTakenError');
const AnyDivOfDivisorAnswerKindNotTakenError = declareRefusal('any/divOf/DivisorAnswerKindNotTakenError');
const AnyDivOfDivisorZeroError = declareRefusal('any/divOf/DivisorZeroError');
const AnyUnionOfPartsAnswerKindNotTakenError = declareRefusal('any/unionOf/PartsAnswerKindNotTakenError');

const A_NUMBER = kindsExpected('number');
const A_MAP_OR_A_SET = kindsExpected('map', 'set');
const isANumber = part => isNumber(beneathTags(part));
const isAMapOrASet = part => isMap(beneathTags(part)) || isSet(beneathTags(part));

const answerOf = async (given, subject) => (typeof given === 'function' ? await given(subject) : given);

async function partsRead(subject, given, input, expected, holds, AnswerKindNotTakenError) {
  const parts = [];
  for (const [index, value] of given.entries()) {
    const part = await answerOf(value, subject);
    if (isErrorValue(part)) return part;
    if (!holds(part)) throw new AnswerKindNotTakenError({ [`${input}/expected`]: expected, [`${input}/answer`]: part, [`${input}/index`]: index });
    parts.push(part);
  }
  return parts;
}

async function numberRead(subject, given, input, AnswerKindNotTakenError) {
  const part = await answerOf(given, subject);
  if (isErrorValue(part) || isANumber(part)) return part;
  throw new AnswerKindNotTakenError({ [`${input}/expected`]: A_NUMBER, [`${input}/answer`]: part });
}

function combined(parts, combine, state) {
  const tally = new TagsInCommon();
  let folded;
  for (const [at, part] of parts.entries()) {
    const met = tally.meet(part);
    if (met !== null) throw pairRefused(met, part);
    folded = at === 0 ? beneathTags(part) : combine(folded, beneathTags(part));
  }
  return underSharedTags(folded, tally.tags, state);
}

const readThenCombined = (input, AnswerKindNotTakenError, combine) => takesAsGiven([input], runsAsCode([input], async (subject, given, state) => {
  const parts = await partsRead(subject, given, input, A_NUMBER, isANumber, AnswerKindNotTakenError);
  return isErrorValue(parts) ? parts : combined(parts, combine, state);
}));

registerStateReader('any/sumOf', readThenCombined('numbers', AnySumOfNumbersAnswerKindNotTakenError, (sum, number) => sum + number));
registerStateReader('any/mulOf', readThenCombined('factors', AnyMulOfFactorsAnswerKindNotTakenError, (product, factor) => product * factor));

registerStateReader('any/subOf', takesAsGiven(['minuend', 'subtrahend'], runsAsCode(['minuend', 'subtrahend'], async (subject, minuend, subtrahend, state) => {
  const left = await numberRead(subject, minuend, 'minuend', AnySubOfMinuendAnswerKindNotTakenError);
  if (isErrorValue(left)) return left;
  const right = await numberRead(subject, subtrahend, 'subtrahend', AnySubOfSubtrahendAnswerKindNotTakenError);
  return isErrorValue(right) ? right : combined([left, right], (a, b) => a - b, state);
})));

registerStateReader('any/divOf', takesAsGiven(['dividend', 'divisor'], runsAsCode(['dividend', 'divisor'], async (subject, dividend, divisor, state) => {
  const left = await numberRead(subject, dividend, 'dividend', AnyDivOfDividendAnswerKindNotTakenError);
  if (isErrorValue(left)) return left;
  const right = await numberRead(subject, divisor, 'divisor', AnyDivOfDivisorAnswerKindNotTakenError);
  if (isErrorValue(right)) return right;
  if (beneathTags(right) === 0) throw new AnyDivOfDivisorZeroError({});
  return combined([left, right], (a, b) => a / b, state);
})));

registerStateReader('any/unionOf', takesAsGiven(['parts'], runsAsCode(['parts'], async (subject, given, state) => {
  const parts = await partsRead(subject, given, 'parts', A_MAP_OR_A_SET, isAMapOrASet, AnyUnionOfPartsAnswerKindNotTakenError);
  if (isErrorValue(parts)) return parts;
  const ofSets = isSet(beneathTags(parts[0]));
  const other = parts.find(part => isSet(beneathTags(part)) !== ofSets);
  if (other !== undefined) throw pairRefused(parts[0], other);
  return combined(parts, unitedOf, state);
})));

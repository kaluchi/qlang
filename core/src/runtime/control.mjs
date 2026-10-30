// [QSBLD#fn], [QSQUO#literal], [QSDSP#walk], [QSCND#boolean]

import { isNull, isErrorValue, beneathTags, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { registerPrimitive, runsAsCode } from '../primitives.mjs';
import { isMissedRead } from '../path-read.mjs';
import { failedOnAPart } from '../eval-trace.mjs';

const AnyCondClausesAnswerKindNotTakenError = declareRefusal('any/cond/ClausesAnswerKindNotTakenError');
const AnyAllOfConditionsAnswerKindNotTakenError = declareRefusal('any/allOf/ConditionsAnswerKindNotTakenError');
const AnyAnyOfConditionsAnswerKindNotTakenError = declareRefusal('any/anyOf/ConditionsAnswerKindNotTakenError');

registerPrimitive('any/if', runsAsCode(['then', 'else'], async (subject, condition, thenCode, elseCode) =>
  (condition ? await thenCode(subject) : await elseCode(subject))));

// [QSCND#boolean]
async function verdictOfConditions(subject, conditions, decisive, AnswerKindNotTakenError) {
  for (const [index, condition] of conditions.entries()) {
    const verdict = typeof condition === 'function' ? await condition(subject) : condition;
    if (isErrorValue(verdict)) return verdict;
    if (typeof beneathTags(verdict) !== 'boolean') throw new AnswerKindNotTakenError({ 'conditions/expected': kindsExpected('boolean'), 'conditions/answer': verdict, 'conditions/index': index });
    if (beneathTags(verdict) === decisive) return decisive;
  }
  return !decisive;
}

registerPrimitive('any/allOf', runsAsCode(['conditions'], (subject, conditions) => verdictOfConditions(subject, conditions, false, AnyAllOfConditionsAnswerKindNotTakenError)));
registerPrimitive('any/anyOf', runsAsCode(['conditions'], (subject, conditions) => verdictOfConditions(subject, conditions, true, AnyAnyOfConditionsAnswerKindNotTakenError)));

// [QSCND#coalesce]
registerPrimitive('any/coalesce', runsAsCode(['alternatives'], async (subject, alternatives) => {
  const isCode = alternative => typeof alternative === 'function';
  const candidates = alternatives.some(isCode) ? alternatives : [subject, ...alternatives];
  for (const alternative of candidates) {
    const answer = isCode(alternative) ? await alternative(subject) : alternative;
    if (isNull(beneathTags(answer)) || (isErrorValue(answer) && isMissedRead(answer) && !failedOnAPart(answer))) continue;
    return answer;
  }
  return NULL;
}));

// [QSCND#branch]
registerPrimitive('any/cond', runsAsCode(['clauses'], async (subject, clauses) => {
  let clauseIndex = 0;
  while (clauseIndex + 1 < clauses.length) {
    const answer = await clauses[clauseIndex](subject);
    if (isErrorValue(answer)) return answer;
    if (typeof beneathTags(answer) !== 'boolean') {
      throw new AnyCondClausesAnswerKindNotTakenError({ 'clauses/expected': kindsExpected('boolean'), 'clauses/answer': answer, 'clauses/index': clauseIndex });
    }
    if (beneathTags(answer)) return await clauses[clauseIndex + 1](subject);
    clauseIndex += 2;
  }
  return clauseIndex < clauses.length ? await clauses[clauseIndex](subject) : NULL;
}));

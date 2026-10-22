// [QSBLD#fn], [QSQUO#literal], [QSDSP#walk], [QSCND#boolean]

import { isNull, isErrorValue, beneathTags, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { registerPrimitive, runs } from '../primitives.mjs';
import { isMissedRead } from '../path-read.mjs';
import { failedOnAPart } from '../eval-trace.mjs';

const AnyCondConditionKindNotTakenError = declareRefusal('any/cond/ConditionKindNotTakenError');
const AnyAllOfConditionKindNotTakenError = declareRefusal('any/allOf/ConditionKindNotTakenError');
const AnyAnyOfConditionKindNotTakenError = declareRefusal('any/anyOf/ConditionKindNotTakenError');

registerPrimitive('any/if', runs(['then', 'else'], async (subject, condition, thenCode, elseCode) =>
  (condition ? await thenCode(subject) : await elseCode(subject))));

// [QSCND#boolean]
async function verdictOfConditions(subject, conditions, decisive, ConditionKindNotTakenError) {
  for (const [index, condition] of conditions.entries()) {
    const verdict = typeof condition === 'function' ? await condition(subject) : condition;
    if (isErrorValue(verdict)) return verdict;
    if (typeof beneathTags(verdict) !== 'boolean') throw new ConditionKindNotTakenError({ index, expected: kindsExpected('boolean'), actualValue: verdict });
    if (beneathTags(verdict) === decisive) return decisive;
  }
  return !decisive;
}

registerPrimitive('any/allOf', runs(['conditions'], (subject, conditions) => verdictOfConditions(subject, conditions, false, AnyAllOfConditionKindNotTakenError)));
registerPrimitive('any/anyOf', runs(['conditions'], (subject, conditions) => verdictOfConditions(subject, conditions, true, AnyAnyOfConditionKindNotTakenError)));

// [QSCND#coalesce]
registerPrimitive('any/coalesce', runs(['alternatives'], async (subject, alternatives) => {
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
registerPrimitive('any/cond', runs(['clauses'], async (subject, clauses) => {
  let clauseIndex = 0;
  while (clauseIndex + 1 < clauses.length) {
    const answer = await clauses[clauseIndex](subject);
    if (isErrorValue(answer)) return answer;
    if (typeof beneathTags(answer) !== 'boolean') {
      throw new AnyCondConditionKindNotTakenError({ index: clauseIndex, expected: kindsExpected('boolean'), actualValue: answer });
    }
    if (beneathTags(answer)) return await clauses[clauseIndex + 1](subject);
    clauseIndex += 2;
  }
  return clauseIndex < clauses.length ? await clauses[clauseIndex](subject) : NULL;
}));

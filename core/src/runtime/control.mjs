// The names of control, residing on `::any`, each taking the values alone, the
// subject and the inputs of its call [QSBLD#fn]: a branch, a clause, an
// alternative and a quote among the conditions of `allOf` and `anyOf` is code
// the name runs only when it is chosen, closed at the call [QSQUO#literal],
// [QSDSP#walk], and the condition of `if` is a boolean computed at the call
// [QSCND#boolean].

import { isNull, isErrorValue, beneathTags, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { registerPrimitive, runs } from '../primitives.mjs';
import { isMissedRead } from '../path-read.mjs';
import { failedOnAPart } from '../eval-trace.mjs';

const AnyCondConditionNotBooleanError = declareRefusal('any/cond/ConditionNotBooleanError');
const AnyAllOfConditionNotBooleanError = declareRefusal('any/allOf/ConditionNotBooleanError');
const AnyAnyOfConditionNotBooleanError = declareRefusal('any/anyOf/ConditionNotBooleanError');

registerPrimitive('any/if', runs(['then', 'else'], async (subject, condition, thenCode, elseCode) =>
  (condition ? await thenCode(subject) : await elseCode(subject))));

// Whether every condition holds of the subject, and whether some does:
// a condition computed at the call is the boolean it answered, a quote
// answers one in its turn, and the first condition that decides answers
// with the quotes after it unrun [QSCND#boolean].
async function verdictOfConditions(subject, conditions, decisive, ConditionNotBooleanError) {
  for (const [index, condition] of conditions.entries()) {
    const verdict = typeof condition === 'function' ? await condition(subject) : condition;
    if (isErrorValue(verdict)) return verdict;
    if (typeof beneathTags(verdict) !== 'boolean') throw new ConditionNotBooleanError({ index, actualValue: verdict });
    if (beneathTags(verdict) === decisive) return decisive;
  }
  return !decisive;
}

registerPrimitive('any/allOf', runs(['conditions'], (subject, conditions) => verdictOfConditions(subject, conditions, false, AnyAllOfConditionNotBooleanError)));
registerPrimitive('any/anyOf', runs(['conditions'], (subject, conditions) => verdictOfConditions(subject, conditions, true, AnyAnyOfConditionNotBooleanError)));

// The first alternative that answers a value, each in its place [QSCND#coalesce].
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

// The clauses alternate a predicate and its branch, a pair at least by
// the invariant of the clauses, and a clause left over is the default.
registerPrimitive('any/cond', runs(['clauses'], async (subject, clauses) => {
  let clauseIndex = 0;
  while (clauseIndex + 1 < clauses.length) {
    const answer = await clauses[clauseIndex](subject);
    if (isErrorValue(answer)) return answer;
    if (typeof beneathTags(answer) !== 'boolean') {
      throw new AnyCondConditionNotBooleanError({ index: clauseIndex, actualValue: answer });
    }
    if (beneathTags(answer)) return await clauses[clauseIndex + 1](subject);
    clauseIndex += 2;
  }
  return clauseIndex < clauses.length ? await clauses[clauseIndex](subject) : NULL;
}));

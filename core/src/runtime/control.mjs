// The verbs of control, residing on `::any`, each a plain function
// over the values the head of its verb checked [D72]: a branch, a clause
// and an alternative is code the verb runs only when it is chosen, closed
// at the call [D43], [D73], and the condition of `if` is a boolean
// computed at the call [D14].
//
// The verbs live in lib/qlang/any.qlang.

import { isNull, isErrorValue, typeKeyword, NULL } from '../types.mjs';
import { declareArityError, declareShapeError } from '../errors.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

// The refusals the head of `if` raises at the places it declares.
declareModifierError('any/IfConditionNotBooleanError', 'if', 2, 'boolean');
declareModifierError('any/IfThenNotQuoteError',        'if', 3, 'quote');
declareModifierError('any/IfElseNotQuoteError',        'if', 4, 'quote');

const AnyCondConditionNotBooleanError = declareShapeError('any/CondConditionNotBooleanError',
  ({ index, actualType }) => `cond takes a boolean from each condition, the condition of modifier ${index} answered ${actualType.name}`,
  { operand: 'cond', expectedType: 'boolean' });
const AnyCoalesceNoAlternativesError = declareArityError('any/CoalesceNoAlternativesError',
  () => 'coalesce requires at least one alternative sub-pipeline',
  { operand: 'coalesce' }
);
const AnyCondNoBranchesError = declareArityError('any/CondNoBranchesError',
  () => 'cond requires at least one (predicate, branch) pair plus an optional trailing default',
  { operand: 'cond' }
);

bindPrim('any/if', async (subject, condition, thenCode, elseCode) =>
  (condition ? await thenCode(subject) : await elseCode(subject)));

// The first alternative that answers neither null nor an error value: a
// strict projection's miss, `/missing` on a map without the key, is an
// error, and the walk skips it as it skips null, so `coalesce ~(/a)
// ~(/b) ~("default")` reads the first value defined. An alternative
// that is no quote answers itself, and a call of such alternatives
// alone reads the subject first, `/timeout | coalesce 30` [D133].
bindPrim('any/coalesce', async (subject, alternatives) => {
  if (alternatives.length === 0) throw new AnyCoalesceNoAlternativesError();
  const isCode = alternative => typeof alternative === 'function';
  const candidates = alternatives.some(isCode) ? alternatives : [subject, ...alternatives];
  for (const alternative of candidates) {
    const answer = isCode(alternative) ? await alternative(subject) : alternative;
    if (isNull(answer) || isErrorValue(answer)) continue;
    return answer;
  }
  return NULL;
});

bindPrim('any/cond', async (subject, clauses) => {
  if (clauses.length < 2) throw new AnyCondNoBranchesError();
  let clauseIndex = 0;
  while (clauseIndex + 1 < clauses.length) {
    const answer = await clauses[clauseIndex](subject);
    if (isErrorValue(answer)) return answer;
    if (typeof answer !== 'boolean') {
      throw new AnyCondConditionNotBooleanError({ index: clauseIndex + 1, actualType: typeKeyword(answer), actualValue: answer });
    }
    if (answer) return await clauses[clauseIndex + 1](subject);
    clauseIndex += 2;
  }
  return clauseIndex < clauses.length ? await clauses[clauseIndex](subject) : NULL;
});

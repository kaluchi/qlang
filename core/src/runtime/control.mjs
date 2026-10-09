// The names of control, residing on `::any`, each a plain function over
// the subject and the parts of its object [D167]: a branch, a clause and
// an alternative is code the name runs only when it is chosen, closed at
// the call [D43], [D73], and the condition of `if` is a boolean computed
// at the call [D14].
//
// The verbs live in lib/qlang/any.qlang.

import { isNull, isErrorValue, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { bindPrim } from '../primitives.mjs';

// The alternatives of `coalesce` and the clauses of `cond` are the whole
// object of the call, which a law refusing it would hand under the tag of
// the word, a value no literal reads back [D42]; the primitive counts them.
const AnyCondConditionNotBooleanError = declareRefusal('any/cond/ConditionNotBooleanError');
const AnyCoalesceNoAlternativesError = declareRefusal('any/coalesce/NoAlternativesError');
const AnyCondNoBranchesError = declareRefusal('any/cond/NoBranchesError');

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

// The clauses alternate a predicate and its branch, a pair at least, and
// a clause left over is the default.
bindPrim('any/cond', async (subject, clauses) => {
  if (clauses.length < 2) throw new AnyCondNoBranchesError();
  let clauseIndex = 0;
  while (clauseIndex + 1 < clauses.length) {
    const answer = await clauses[clauseIndex](subject);
    if (isErrorValue(answer)) return answer;
    if (typeof answer !== 'boolean') {
      throw new AnyCondConditionNotBooleanError({ index: clauseIndex, actualValue: answer });
    }
    if (answer) return await clauses[clauseIndex + 1](subject);
    clauseIndex += 2;
  }
  return clauseIndex < clauses.length ? await clauses[clauseIndex](subject) : NULL;
});

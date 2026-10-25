// [QSPRN#print], [QSPRN#elide], [QSPRN#budget]

import { registerStateReader } from '../primitives.mjs';
import { isErrorValue, tagOf, makeErrorValue } from '../types.mjs';
import { elideToBudget, alertWithin, headOfAnswer, lengthOf, ANSWER_BUDGET } from '../elide.mjs';
import { rootState, markRootVerbScope } from '../state.mjs';
import { printValue } from '../print-value.mjs';
import { kindOfAValueOf, nodeOf, residenceOnSubject } from '../nouns.mjs';
import { callVerbOn } from '../eval.mjs';
import { servesTheSubject } from '../dispatch.mjs';
import { declareRefusal } from '../errors.mjs';
import { errorFromQlang } from '../error-convert.mjs';

const QlangAnswerBeyondBudgetError = declareRefusal('qlang/AnswerBeyondBudgetError');

// [QSPRN#print]
export async function printsOfKinds(value, scope, state = rootState(value, scope)) {
  const printedByKind = new Map();
  await collectPrintsOfKinds(value, markRootVerbScope(new Map(scope)), state, nodeOf(scope, 'any/print'), printedByKind);
  return part => printedByKind.get(part);
}

// [QSERR#print]
export async function printAnswer(value, scope, state = rootState(value, scope)) {
  const printed = printValue(value, 0, await printsOfKinds(value, scope, state));
  return isErrorValue(value) ? `${RAISED_LINE}\n${printed}` : printed;
}

// [QSPRN#budget]
export async function boundAnswer(answer, scope, written = null) {
  const printedOf = await printsOfKinds(answer, scope);
  const failed = isErrorValue(answer);
  const shown = failed ? alertWithin(answer, ANSWER_BUDGET, printedOf, kindOfAValueOf(scope, answer.tag.name) !== null) : answer;
  const characters = lengthOf(written ?? printValue(shown, 0, printedOf));
  if (characters <= ANSWER_BUDGET) return shown;
  const refused = errorFromQlang(new QlangAnswerBeyondBudgetError({ characters, budget: ANSWER_BUDGET, actualValue: headOfAnswer(answer, printedOf) }), undefined, scope);
  return alertWithin(makeErrorValue(refused.tag, new Map(refused.facts).set('actualTag', failed ? answer.tag : tagOf(answer))), ANSWER_BUDGET, printedOf, true);
}

const RAISED_LINE = '|~| raised, and no !| caught it';

async function collectPrintsOfKinds(part, scope, state, printOfAny, printedByKind) {
  if (!isErrorValue(part)) {
    const printOfKind = residenceOnSubject(scope, 'print', part);
    if (printOfKind !== printOfAny && servesTheSubject(printOfKind, part)) {
      const printed = await callVerbOn(printOfKind, part, state);
      printedByKind.set(part, typeof printed === 'string' ? printed : printValue(printed));
      return;
    }
  }
  if (part === null || typeof part !== 'object') return;
  const parts = part instanceof Map ? part.values()
    : Array.isArray(part) ? part
    : isErrorValue(part) ? part.facts.values()
    : 'payload' in part ? [part.payload] : [];
  for (const inner of parts) await collectPrintsOfKinds(inner, scope, state, printOfAny, printedByKind);
}

registerStateReader('any/print', (subject, state) => printAnswer(subject, state.scope, state));
registerStateReader('any/elide', async (subject, budget, state) => elideToBudget(subject, budget, await printsOfKinds(subject, state.scope, state)));

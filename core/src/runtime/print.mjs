// [QSPRN#print], [QSPRN#excerpt], [QSPRN#budget]

import { registerStateReader } from '../primitives.mjs';
import { isErrorValue } from '../types.mjs';
import { alertOf, lengthOf, excerptOfElements, excerptOfEntries, excerptOfSteps, excerptOfProse, excerptOfText, excerptOfPrint, excerptOfFrames, ANSWER_BUDGET } from '../rooms.mjs';
import { rootState, markRootVerbScope } from '../state.mjs';
import { printValue } from '../print-value.mjs';
import { nodeOf, residenceOnSubject } from '../nouns.mjs';
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

// [QSPRN#excerpt]
export function excerptsOfKinds(scope, state = rootState(null, scope)) {
  const verbScope = markRootVerbScope(new Map(scope));
  return value => callVerbOn(residenceOnSubject(verbScope, 'excerpt', value), value, state);
}

// [QSPRN#budget], [QSERR#alert], [QSHST#cell]
export async function boundAnswer(answer, scope, written = null, keep = null) {
  const printedOf = await printsOfKinds(answer, scope);
  if (isErrorValue(answer)) return alertOf(answer, excerptsOfKinds(scope), printedOf);
  const characters = lengthOf(written ?? printValue(answer, 0, printedOf));
  if (characters <= ANSWER_BUDGET) return answer;
  const facts = { characters, budget: ANSWER_BUDGET, answer };
  if (keep !== null) facts.cell = await keep(answer);
  return alertOf(errorFromQlang(new QlangAnswerBeyondBudgetError(facts), undefined, scope), excerptsOfKinds(scope), printedOf);
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

// [QSPRN#excerpt]
const excerptWithinItsBudget = told => async (subject, budget, state) => told(subject, Math.min(budget, ANSWER_BUDGET), await printsOfKinds(subject, state.scope, state));

registerStateReader('vec/excerpt', excerptWithinItsBudget(excerptOfElements));
registerStateReader('map/excerpt', excerptWithinItsBudget(excerptOfEntries));
registerStateReader('quote/excerpt', excerptWithinItsBudget(excerptOfSteps));
registerStateReader('doc/excerpt', excerptWithinItsBudget(excerptOfProse));
registerStateReader('string/excerpt', excerptWithinItsBudget(excerptOfText));
registerStateReader('trace/excerpt', excerptWithinItsBudget(excerptOfFrames));
registerStateReader('any/excerpt', excerptWithinItsBudget(excerptOfPrint));

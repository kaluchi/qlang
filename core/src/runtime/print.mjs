// [QSPRN#print], [QSPRN#excerpt], [QSPRN#budget]

import { registerStateReader } from '../primitives.mjs';
import { isErrorValue } from '../types.mjs';
import { alertOf, lengthOf, ANSWER_BUDGET, FIRST_VIEW } from '../rooms.mjs';
import { rootState, markRootVerbScope } from '../state.mjs';
import { printValue } from '../print-value.mjs';
import { nodeOf, residenceOnSubject, kindsOfWalk, kindOfAValueOf } from '../nouns.mjs';
import { chainOfKind } from '../chain.mjs';
import { ANY_KIND_NAME } from '../address.mjs';
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
export const verbOfAView = (scope, kindName, name) => nodeOf(scope, `${kindName}/${name}`) ?? nodeOf(scope, `${ANY_KIND_NAME}/${name}`);

function viewsRevealedOf(value, scope) {
  for (const kindName of kindsOfWalk(value)) {
    const kind = kindOfAValueOf(scope, kindName);
    if (kind !== null && chainOfKind(kind).reveals.length > 0) return chainOfKind(kind).reveals.map(name => [name, verbOfAView(scope, kindName, name)]);
  }
  return [];
}

export function viewsOfKinds(scope, state = rootState(null, scope)) {
  return async value => {
    const views = [];
    for (const [name, verb] of [[FIRST_VIEW, verbOfAView(scope, ANY_KIND_NAME, FIRST_VIEW)], ...viewsRevealedOf(value, scope)]) {
      if (verb === null) continue;
      const answered = await callVerbOn(verb, value, state);
      if (!isErrorValue(answered)) views.push([name, answered]);
    }
    return views;
  };
}

// [QSPRN#budget], [QSERR#alert], [QSHST#cell]
export async function boundAnswer(answer, scope, written = null, keep = null) {
  const printedOf = await printsOfKinds(answer, scope);
  const room = { keep, viewsOf: viewsOfKinds(scope) };
  if (isErrorValue(answer)) return alertOf(answer, room, printedOf);
  const characters = lengthOf(written ?? printValue(answer, 0, printedOf));
  if (characters <= ANSWER_BUDGET) return answer;
  return alertOf(errorFromQlang(new QlangAnswerBeyondBudgetError({ characters, budget: ANSWER_BUDGET, answer }), scope), room, printedOf);
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

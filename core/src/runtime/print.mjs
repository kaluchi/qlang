// [QSPRN#print], [QSPRN#excerpt], [QSPRN#budget]

import { registerStateReader } from '../primitives.mjs';
import { isErrorValue, LEGEND_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { alertOf, lengthOf, ANSWER_BUDGET, FIRST_VIEW } from '../rooms.mjs';
import { rootState, queryStateOf } from '../state.mjs';
import { printValue } from '../print-value.mjs';
import { verbOfAView, kindsOfWalk, kindOfAValueOf } from '../nouns.mjs';
import { chainOfKind } from '../chain.mjs';
import { ANY_KIND_NAME } from '../address.mjs';
import { callVerbOn } from '../eval.mjs';
import { declareRefusal } from '../errors.mjs';
import { errorFromQlang } from '../error-convert.mjs';
import { printOfALegend } from './legend-primitives.mjs';

const QlangAnswerBeyondBudgetError = declareRefusal('qlang/AnswerBeyondBudgetError');

// [QSPRN#print], [QSPRN#legend]
export async function printsOfLegends(value, scope, state = rootState(value, scope)) {
  const printedOf = new Map();
  await collectLegends(value, queryStateOf(state), printedOf);
  return part => printedOf.get(part);
}

// [QSERR#print]
export async function printAnswer(value, scope, state = rootState(value, scope)) {
  const printed = printValue(value, 0, await printsOfLegends(value, scope, state));
  return isErrorValue(value) ? `${RAISED_LINE}\n${printed}` : printed;
}

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
  const printedOf = await printsOfLegends(answer, scope);
  const room = { keep, viewsOf: viewsOfKinds(scope) };
  if (isErrorValue(answer)) return alertOf(answer, room, printedOf);
  const characters = lengthOf(written ?? printValue(answer, 0, printedOf));
  if (characters <= ANSWER_BUDGET) return answer;
  return alertOf(errorFromQlang(new QlangAnswerBeyondBudgetError({ characters, budget: ANSWER_BUDGET, answer }), scope), room, printedOf);
}

const RAISED_LINE = '|~| raised, and no !| caught it';

// [QSPRN#legend]
const isLegend = value => value?.[TAG_HEADER_SYMBOL]?.name === LEGEND_TAG.name;

async function collectLegends(value, state, printedOf) {
  const pending = [value];
  const walked = new Set();
  while (pending.length > 0) {
    const part = pending.pop();
    if (isLegend(part)) {
      printedOf.set(part, await printOfALegend(part, state, printsOfLegends));
      continue;
    }
    if (part === null || typeof part !== 'object' || walked.has(part)) continue;
    walked.add(part);
    const parts = part instanceof Map ? part.values()
      : Array.isArray(part) ? part
      : isErrorValue(part) ? part.facts.values()
      : 'payload' in part ? [part.payload] : [];
    for (const inner of parts) pending.push(inner);
  }
}

registerStateReader('any/print', (subject, state) => printAnswer(subject, state.scope, state));

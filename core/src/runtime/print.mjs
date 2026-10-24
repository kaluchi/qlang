// [QSPRN#print], [QSPRN#elide], [QSPRN#budget]

import { registerStateReader } from '../primitives.mjs';
import { isErrorValue, typeOf, makeErrorValue } from '../types.mjs';
import { elideToBudget, alertWithin, headOfAnswer, lengthOf, EXCERPT_CHARACTERS, ANSWER_BUDGET } from '../elide.mjs';
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

// [QSPRN#budget]
export async function boundAnswer(answer, scope, written = null) {
  const printedOf = await printsOfKinds(answer, scope);
  const failed = isErrorValue(answer);
  const shown = failed ? alertWithin(answer, ANSWER_BUDGET, printedOf) : answer;
  const characters = lengthOf(written ?? printValue(shown, 0, printedOf));
  if (characters <= ANSWER_BUDGET) return shown;
  const refused = errorFromQlang(new QlangAnswerBeyondBudgetError({ characters, budget: ANSWER_BUDGET, actualValue: headOfAnswer(answer, printedOf) }), undefined, scope);
  return alertWithin(makeErrorValue(refused.tag, new Map(refused.facts).set('actualType', failed ? answer.tag : typeOf(answer))), ANSWER_BUDGET, printedOf);
}

const RAISED_LINE = '|~| raised, and no !| caught it';

// [QSERR#print]
export function caretOf(answer) {
  if (!isErrorValue(answer) || answer.tag.name !== 'quote/ParseError') return null;
  const source = answer.facts.get('source');
  const location = answer.facts.get('location');
  if (typeof source !== 'string' || source.includes('\n') || typeOf(location).name !== 'span') return null;
  const [, startLine, startColumn, , endLine, endColumn] = location;
  const characters = Array.from(source);
  const pastTheLine = characters.length + 1;
  if (startColumn < 1 || startColumn > pastTheLine) return null;
  const end = endLine === startLine ? Math.min(endColumn, pastTheLine) : pastTheLine;
  const from = Math.max(0, Math.min(startColumn - 1 - EXCERPT_CHARACTERS / 2, characters.length - EXCERPT_CHARACTERS));
  const to = Math.min(characters.length, from + EXCERPT_CHARACTERS);
  const before = from > 0 ? '…' : '';
  const line = `${before}${characters.slice(from, to).join('')}${to < characters.length ? '…' : ''}`;
  const reach = Math.max(1, Math.min(end, to + 1) - startColumn);
  return `|~| ${line}\n|~| ${' '.repeat(startColumn - 1 - from + before.length)}^${'~'.repeat(reach - 1)}`;
}

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

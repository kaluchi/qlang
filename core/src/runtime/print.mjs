// The primitives of `print`, the text that reads back as any value, the print
// a kind answers of its own taken for each part of that kind [QSPRN#print],
// and of `elide`, the value within a budget of its print [QSHST#answer].

import { registerStateReader } from '../primitives.mjs';
import { TAG_HEADER_SYMBOL, isErrorValue, typeOf } from '../types.mjs';
import { elide, elideAnswer as answerWithin, EXCERPT_CHARACTERS } from '../elide.mjs';
import { rootState } from '../state.mjs';
import { printValue } from '../print-value.mjs';
import { nodeOf, residenceOnSubject } from '../nouns.mjs';
import { callVerbOn } from '../eval.mjs';

// printsOfKinds(value, scope, state?) → `printedOf(part)`: the print a kind
// answers of its own for each part of the value whose kind declares one,
// found by the walk of that part, a fact of an error among them, and
// undefined for every other part, which the forms of the core write
// [QSPRN#print].
export async function printsOfKinds(value, scope, state = rootState(value, scope)) {
  const printedByKind = new Map();
  await collectPrintsOfKinds(value, scope, state, nodeOf(scope, 'any/print'), printedByKind);
  return part => printedByKind.get(part);
}

// printAnswer(value, scope, state?) → the print of a value: a part under a
// tag whose kind answers a `print` of its own prints through it, and the
// forms of the core print the rest. An answer that is a failure, which a
// host meets alone since a step skips it, prints as its error at rest
// under a line comment that says it was raised, which a reading of the
// literal passes over [QSERR#print].
export async function printAnswer(value, scope, state = rootState(value, scope)) {
  const printed = printValue(value, 0, await printsOfKinds(value, scope, state));
  return isErrorValue(value) ? `${RAISED_LINE}\n${printed}` : printed;
}

// elideAnswer(answer, budget, scope) → an answer as a host prints it: a value
// whole, or within the budget asked for, and an error its alert, each print
// measured as the host writes it [QSHST#answer], [QSPRN#elide].
export async function elideAnswer(answer, budget, scope) {
  return answerWithin(answer, budget, await printsOfKinds(answer, scope));
}

const RAISED_LINE = '|~| raised, and no !| caught it';

// caretOf(answer) → for the refusal of a text, the line `:source` holds within
// an excerpt around the column its `:location` names, an ellipsis where the
// excerpt cuts it, and a caret under that column, the two line comments a host
// that prints for a person's eye draws below it [QSERR#print]; null
// otherwise.
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
  if (part === null || typeof part !== 'object') return;
  if (part[TAG_HEADER_SYMBOL] !== undefined) {
    const printOfKind = residenceOnSubject(scope, 'print', part);
    if (printOfKind !== null && printOfKind !== printOfAny) {
      const printed = await callVerbOn(printOfKind, part, state);
      printedByKind.set(part, typeof printed === 'string' ? printed : printValue(printed));
      return;
    }
  }
  const parts = part instanceof Map ? part.values()
    : Array.isArray(part) ? part
    : isErrorValue(part) ? part.facts.values()
    : 'payload' in part ? [part.payload] : [];
  for (const inner of parts) await collectPrintsOfKinds(inner, scope, state, printOfAny, printedByKind);
}

registerStateReader('any/print', (subject, state) => printAnswer(subject, state.scope, state));
registerStateReader('any/elide', async (subject, budget, state) => elide(subject, budget, await printsOfKinds(subject, state.scope, state)));

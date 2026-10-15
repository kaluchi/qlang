// The primitives of `print`, the text that reads back as any value, the print
// a kind answers of its own taken for each part of that kind [QSPRN#print],
// and of `elide`, the value within a budget of its print [QSHST#answer].

import { bindStateReader } from '../primitives.mjs';
import { TAG_HEADER_SYMBOL, isErrorValue } from '../types.mjs';
import { elide, elideAnswer as answerWithin } from '../elide.mjs';
import { rootState } from '../state.mjs';
import { printValue } from './print-value.mjs';
import { nodeOf, residenceOnSubject } from './nouns.mjs';
import { callMemberOn } from '../eval.mjs';

// printsOfKinds(value, env, state?) → `printedOf(part)`: the print a kind
// answers of its own for each part of the value whose kind declares one,
// found by the walk of that part, a fact of an error among them, and
// undefined for every other part, which the forms of the core write
// [QSPRN#print].
export async function printsOfKinds(value, env, state = rootState(value, env)) {
  const printedByKind = new Map();
  await collectPrintsOfKinds(value, env, state, nodeOf(env, 'any/print'), printedByKind);
  return part => printedByKind.get(part);
}

// printAnswer(value, env, state?) → the print of a value: a part under a
// tag whose kind answers a `print` of its own prints through it, and the
// forms of the core print the rest. An answer that is a failure, which a
// host meets alone since a step skips it, prints as its error at rest
// under a line comment that says it was raised, which a reading of the
// literal passes over [QSERR#rest].
export async function printAnswer(value, env, state = rootState(value, env)) {
  const printed = printValue(value, 0, await printsOfKinds(value, env, state));
  return isErrorValue(value) ? `${RAISED_LINE}\n${printed}` : printed;
}

// elideAnswer(answer, budget, env) → an answer as a host prints it: a value
// whole, or within the budget asked for, and an error its alert, each print
// measured as the host writes it [QSHST#answer], [QSPRN#elide].
export async function elideAnswer(answer, budget, env) {
  return answerWithin(answer, budget, await printsOfKinds(answer, env));
}

const RAISED_LINE = '|~| raised, and no !| caught it';

async function collectPrintsOfKinds(part, env, state, printOfAny, printedByKind) {
  if (part === null || typeof part !== 'object') return;
  if (part[TAG_HEADER_SYMBOL] !== undefined) {
    const printOfKind = residenceOnSubject(env, 'print', part);
    if (printOfKind !== null && printOfKind !== printOfAny) {
      const printed = await callMemberOn(printOfKind, part, state);
      printedByKind.set(part, typeof printed === 'string' ? printed : printValue(printed));
      return;
    }
  }
  const parts = part instanceof Map ? part.values()
    : Array.isArray(part) ? part
    : isErrorValue(part) ? part.descriptor.values()
    : 'payload' in part ? [part.payload] : [];
  for (const inner of parts) await collectPrintsOfKinds(inner, env, state, printOfAny, printedByKind);
}

bindStateReader('any/print', (subject, state) => printAnswer(subject, state.env, state));
bindStateReader('any/elide', async (subject, budget, state) => elide(subject, budget, await printsOfKinds(subject, state.env, state)));

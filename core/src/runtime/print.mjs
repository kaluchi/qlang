// The primitives of `print`, the text that reads back as any value, the
// print a kind answers of its own taken for each part of that kind
// [D96], and of `elide`, the value within a budget of its print [D120].

import { bindPrim, bindStateReader } from '../primitives.mjs';
import { TAG_HEADER_SYMBOL, isErrorValue } from '../types.mjs';
import { elide } from '../elide.mjs';
import { rootState } from '../state.mjs';
import { printValue } from './print-value.mjs';
import { nodeOf, residenceOnSubject } from './nouns.mjs';
import { callMemberOn } from '../eval.mjs';

// printAnswer(value, env, state?) → the print of a value: a part under a
// tag whose kind answers a `print` of its own prints through it, and the
// forms of the core print the rest. An answer that is a failure, which a
// host meets alone since a step skips it, prints as its error at rest
// under a line comment that says it was raised, which a reading of the
// literal passes over [D219].
export async function printAnswer(value, env, state = rootState(value, env)) {
  const printedByKind = new Map();
  await collectPrintsOfKinds(value, env, state, nodeOf(env, 'any/print'), printedByKind);
  const printed = printValue(value, 0, part => printedByKind.get(part));
  return isErrorValue(value) ? `${RAISED_LINE}\n${printed}` : printed;
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
    : 'payload' in part ? [part.payload] : [];
  for (const inner of parts) await collectPrintsOfKinds(inner, env, state, printOfAny, printedByKind);
}

bindStateReader('any/print', (subject, state) => printAnswer(subject, state.env, state));
bindPrim('any/elide', (subject, budget) => elide(subject, budget));

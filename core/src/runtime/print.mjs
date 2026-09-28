// The primitives of `print`, the text that reads back as any value, the
// print a kind answers of its own taken for each part of that kind
// [D96], and of `elide`, the value within a budget of its print [D120].

import { bindPrim, bindStateReader } from '../primitives.mjs';
import { isVerb, isErrorValue, bindingValueOf, TAG_HEADER_SYMBOL } from '../types.mjs';
import { elide } from '../elide.mjs';
import { rootState } from '../state.mjs';
import { printValue } from './print-value.mjs';
import { addressedVerb, residenceOnSubject } from './nouns.mjs';
import { applyVerbOn } from './verb.mjs';

// printAnswer(value, env, state?) → the print of a value: a part under a
// tag whose kind answers a `print` of its own prints through it, and the
// forms of the core print the rest.
export async function printAnswer(value, env, state = rootState(value, env)) {
  const printedByKind = new Map();
  await collectPrintsOfKinds(value, env, state, addressedVerb(env, 'any/print')?.descriptor, printedByKind);
  return printValue(value, 0, part => printedByKind.get(part));
}

async function collectPrintsOfKinds(part, env, state, printOfAny, printedByKind) {
  if (part === null || typeof part !== 'object') return;
  if (part[TAG_HEADER_SYMBOL] !== undefined) {
    const printOfKind = bindingValueOf(residenceOnSubject(env, 'print', part));
    if (isVerb(printOfKind) && printOfKind !== printOfAny) {
      const printed = (await applyVerbOn(printOfKind, part, [], state, 'print')).pipeValue;
      printedByKind.set(part, typeof printed === 'string' ? printed : printValue(printed));
      return;
    }
  }
  const parts = isErrorValue(part) ? part.descriptor.values()
    : part instanceof Map ? part.values()
    : Array.isArray(part) ? part
    : 'payload' in part ? [part.payload] : [];
  for (const inner of parts) await collectPrintsOfKinds(inner, env, state, printOfAny, printedByKind);
}

bindStateReader('print', (subject, state) => printAnswer(subject, state.env, state));
bindPrim('elide', (subject, budget) => elide(subject, budget));

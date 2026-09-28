// The primitives of `parse`, which reads source text into a quote and
// prints a quote as its text, of `apply`, which runs a quote against the
// subject [D43], [D72], of a doc's `content`, which writes its quotes as
// text among its prose, and `segments`, its parts [D95], and of `print`,
// the text that reads back as any value [D96].

import { bindPrim, bindStateReader } from '../primitives.mjs';
import { isQuote, isVerb, isErrorValue, isValueClass, bindingValueOf, TAG_HEADER_SYMBOL } from '../types.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { quoteOfSource, printQuoteSource, docText } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';
import { elide } from '../elide.mjs';
import { codeOf } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { printValue } from './print-value.mjs';
import { addressedVerb, residenceOnSubject } from './nouns.mjs';
import { applyVerbOn } from './verb.mjs';

// The refusal the head of `apply` raises at the code it declares.
declareModifierError('ApplyCodeNotQuoteError', 'apply', 2, 'quote');

// A source the parser refuses answers the `::ParseError` with the
// location and the excerpt of the source.
bindPrim('parse', subject => {
  if (isQuote(subject)) return printQuoteSource(subject);
  try {
    return quoteOfSource(subject, 'parse-operand');
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
});

bindPrim('apply', async (subject, code) => await code(subject));

bindPrim('docContent', docText);
bindPrim('docSegments', doc => Object.freeze([...doc]));
bindPrim('docLaws', doc => Object.freeze(doc.filter(isQuote)));
bindPrim('docLinks', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'link'))));
bindPrim('docSnippets', doc => Object.freeze(doc.filter(segment => holdsRole(segment, 'snippet'))));
bindPrim('elide', (subject, budget) => elide(subject, budget));

// A quote opens to the answer of its query, run in the scope of the
// reader that opens it beneath the tags over it, so a page names what its
// reader's scope holds [D111], [D122].
bindStateReader('quoteOpen', async (segment, state) => {
  let query = segment;
  while (isValueClass(query, 'taggedInstance')) query = query.payload;
  return await codeOf(query, state)(null);
});

// A segment in a role: a quote under a stack of tags that holds the tag
// of the role, `::link` or `::snippet`, a host's tag over it among them
// [D108], [D122].
function holdsRole(segment, roleName) {
  for (let beneath = segment; isValueClass(beneath, 'taggedInstance'); beneath = beneath.payload) {
    if (beneath.tag.name === roleName) return true;
  }
  return false;
}

// printAnswer(value, env, state?) → the print of a value: a part under a
// tag whose kind answers a `print` of its own prints through it, and the
// forms of the core print the rest [D96].
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

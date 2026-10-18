// The primitives of code as a value: `parse`, which reads source text into a
// quote, `toString`, which writes a quote as the text of its code, `apply`,
// which runs a quote or a path against the subject, and a function with a
// vector of args, as a call holds its args, and `open`, which runs the query a
// quote holds as held code, in a lane of its own [QSQUO#apply].

import { registerPrimitive, registerStateReader, runs } from '../primitives.mjs';
import { quoteOfSource, printQuoteSource } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';
import { declareRefusal } from '../errors.mjs';
import { isFn } from '../types.mjs';
import { codeOf, applyFunction } from '../eval.mjs';

const AnyApplyArgsNotTakenError = declareRefusal('any/apply/args/NotTakenError');

// A source the parser refuses answers the `::quote/ParseError` with the
// location and the line where the reading stopped, and a quote writes the text of its
// code, its steps as the printer writes them [QSQUO#parse].
registerStateReader('string/parse', (source, state) => {
  try {
    return quoteOfSource(source, 'string/parse');
  } catch (parseErr) {
    return errorFromParse(parseErr, state.env);
  }
});
registerPrimitive('quote/toString', quote => printQuoteSource(quote));

// A function takes the args its inputs read, and a quote and a path take
// none.
registerStateReader('any/apply', runs(['code'], async (subject, code, args, state) => {
  if (isFn(code)) return await applyFunction(code, subject, args, state);
  if (args.length > 0) throw new AnyApplyArgsNotTakenError({ actualValue: args });
  return await code(subject);
}));

// A quote opens to the answer of its query, run as held code in the lane
// of the step that opens it; the walk of its subject hands the quote
// beneath the tags of a link or a snippet, so a page names the verbs and
// the labels its reader's scope holds [QSQUO#held].
registerStateReader('quote/open', async (query, state) => await codeOf(query, state)(null));

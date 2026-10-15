// The primitives of code as a value: `parse`, which reads source text into a
// quote and prints a quote as its text, `apply`, which runs a quote or a path
// against the subject [QSQUO#literal], [QSDSP#residence], and a function with
// a vector of arguments, as a call holds its objects [QSBLD#fn], and `open`,
// which runs the query a quote holds as held code, in a lane of its own
// [QSSLF#page], [QSSLF#doc], [QSQUO#held].

import { bindPrim, bindStateReader, runs } from '../primitives.mjs';
import { quoteOfSource, printQuoteSource } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';
import { declareRefusal } from '../errors.mjs';
import { isFn } from '../types.mjs';
import { codeOf, applyFunction } from '../eval.mjs';

const AnyApplyArgsNotTakenError = declareRefusal('any/apply/args/NotTakenError');

// A source the parser refuses answers the `::quote/ParseError` with
// the location and the excerpt of the source; a quote answers the
// source it prints as.
bindStateReader('string/parse', (source, state) => {
  try {
    return quoteOfSource(source, 'string/parse');
  } catch (parseErr) {
    return errorFromParse(parseErr, state.env);
  }
});
bindPrim('quote/parse', quote => printQuoteSource(quote));

// A function takes the arguments its inputs read, and a quote and a path
// take none.
bindStateReader('any/apply', runs(['code'], async (subject, code, args, state) => {
  if (isFn(code)) return await applyFunction(code, subject, args, state);
  if (args.length > 0) throw new AnyApplyArgsNotTakenError({ actualValue: args });
  return await code(subject);
}));

// A quote opens to the answer of its query, run as held code in the lane
// of the step that opens it; the walk of its subject hands the quote
// beneath the tags of a link or a snippet, so a page names the words and
// the labels its reader's scope holds [QSSLF#doc], [QSSLF#page], [QSQUO#held].
bindStateReader('quote/open', async (query, state) => await codeOf(query, state)(null));

// The primitives of code as a value: `parse`, which reads source text
// into a quote and prints a quote as its text, `apply`, which runs a
// quote against the subject [D43], [D72], and `open`, which runs the
// query a quote holds in the scope of its reader [D111], [D122].

import { bindPrim, bindStateReader } from '../primitives.mjs';
import { quoteOfSource, printQuoteSource } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';
import { codeOf } from '../eval.mjs';

// A source the parser refuses answers the `::quote/ParseError` with
// the location and the excerpt of the source; a quote answers the
// source it prints as.
bindStateReader('string/parse', (source, state) => {
  try {
    return quoteOfSource(source, 'parse-operand');
  } catch (parseErr) {
    return errorFromParse(parseErr, state.env);
  }
});
bindPrim('quote/parse', quote => printQuoteSource(quote));

bindPrim('any/apply', async (subject, code) => await code(subject));

// A quote opens to the answer of its query, run in the scope of the
// reader that opens it; the walk of its subject hands the quote beneath
// the tags of a link or a snippet, so a page names what its reader's
// scope holds [D111], [D122].
bindStateReader('quote/open', async (query, state) => await codeOf(query, state)(null));

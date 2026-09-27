// The primitives of `parse`, which reads source text into a quote and
// prints a quote as its text, of `apply`, which runs a quote against the
// subject [D43], [D72], and of a doc's `join`, which writes its quotes as
// text among its prose [D94].

import { bindPrim } from '../primitives.mjs';
import { isQuote } from '../types.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { quoteOfSource, printQuoteSource, docText } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';

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

bindPrim('docText', docText);

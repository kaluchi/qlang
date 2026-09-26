// `parse` and `apply`, which close the ring of source text, quote and
// value, each a plain function over the values the head of its verb
// checked [D72]: `parse` resides on `::string` and on `::quote` under
// its contract on `::qlang/any`, and `apply` on `::qlang/any`.
//
//   string | parse       → quote, and a quote → its string (the involution)
//   subject | apply code → the value of the code run against the subject
//
// `apply` runs its code closed at the call [D43], [D73], a fork whose
// declarations stay inside it, one frame below the step, so a quote that
// applies itself descends a frame per re-entry until the depth budget
// lifts `EvaluationDepthExceededError`; a trail replays as
// `error !| /trail | :t / | start | apply t`.

import { bindPrim } from '../primitives.mjs';
import { isQuote } from '../types.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { quoteOfSource, printQuoteSource } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';

// The refusal the head of `apply` raises at the code it declares.
declareModifierError('ApplyCodeNotQuoteError', 'apply', 2, 'quote');

// A quote prints as its text; a string reads as the quote of its
// steps. A source the parser refuses answers the `::ParseError` value
// `errorFromParse` builds, with the location and the excerpt of the
// source, where the fault conversion of a step would answer a host's
// descriptor without them.
bindPrim('parse', subject => {
  if (isQuote(subject)) return printQuoteSource(subject);
  try {
    return quoteOfSource(subject, 'parse-operand');
  } catch (parseErr) {
    return errorFromParse(parseErr);
  }
});

bindPrim('apply', async (subject, code) => await code(subject));

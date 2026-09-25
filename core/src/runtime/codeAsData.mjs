// `parse` / `apply` — the codeAsData ring closer.
//
//   string | parse       → quote, and a quote → its string (the involution)
//   subject | apply code → the value of the quote run against the subject
//
// Together they round-trip qlang source text → data → pipeValue
// without leaving the language. `parse` flips a string and a quote,
// the way `keyword` flips a string and a keyword: text reads into the
// quote of its steps, and a quote prints back as text. `apply` runs
// the quote its captured arg answers against the subject, subject
// first like every other operand, so `x | apply /` runs a quote
// against itself and a trail replays as
// `error !| /trail | as :t | start | apply t`.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { nestState, withPipeValue } from '../state.mjs';
import { isQuote, isVerb, isErrorValue, envToRun } from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { evalAst } from '../eval.mjs';
import { callVerb } from './verb.mjs';
import { quoteOfSource, printQuoteSource, astOfQuote } from '../quote.mjs';
import { errorFromParse } from '../error-convert.mjs';

const ParseSubjectNotStringOrQuoteError = declareSubjectError(
  'ParseSubjectNotStringOrQuoteError', 'parse', ['string', 'quote']);

const ApplyCodeNotQuoteError = declareModifierError(
  'ApplyCodeNotQuoteError', 'apply', 2, 'quote');

// `parse` — a quote prints as its text; a string reads as the quote of
// its steps. Malformed sources surface on the fail-track: the peggy
// `ParseError` is caught and converted to a qlang error value through
// `errorFromParse`, which stamps the `::ParseError` identity on the
// error's JS-header tag slot plus the peggy source location and
// excerpt onto the descriptor (the `::ParseError` tag-binding's
// catalog body carries `:category :parseError` for the broad-bucket
// reading via `result !| type | spec | /category`). The converted
// error becomes the new pipeValue directly without throwing — the
// evalNode fallback would route ParseError through `errorFromForeign`
// (yielding a host-shaped descriptor) and lose the parse-specific
// excerpt + expected/found fields a user-facing operand should
// preserve.
export const parseOperand = stateOp('parse', 1, async (state, _parseLambdas) => {
  const parseSubject = state.pipeValue;
  if (isQuote(parseSubject)) return withPipeValue(state, printQuoteSource(parseSubject));
  if (typeof parseSubject !== 'string') throw new ParseSubjectNotStringOrQuoteError(parseSubject);
  try {
    return withPipeValue(state, quoteOfSource(parseSubject, 'parse-operand'));
  } catch (parseErr) {
    return withPipeValue(state, errorFromParse(parseErr));
  }
});

// `apply code` — runs the quote its captured arg answers against the
// subject, under the fork rule: the declarations the code makes stay
// inside it, and only its value comes out. A quote written as a
// modifier runs in the environment of its call [D43], and a verb with
// its defaults [D67]. A leading combinator
// (`~(* mul 2)` / `~(!| /trail)`) routes the first step through that
// combinator, so a pipeline-suffix shape replays semantically. Code
// that is an error is that error, unchanged. The code runs one frame
// below the `apply` step, so a quote that applies itself descends a
// frame per re-entry until the depth budget lifts
// `EvaluationDepthExceededError`. A quote assembled from data is
// printed and parsed the first time it runs, and a `ParseError` there
// rides out into the per-node fault-conversion seam in `evalNode`.
export const applyOperand = stateOp('apply', 2, async (state, applyLambdas) => {
  const code = await applyLambdas[0](state.pipeValue);
  if (isErrorValue(code)) return withPipeValue(state, code);
  if (isVerb(code)) return withPipeValue(state, await callVerb(code, [], state, null));
  if (!isQuote(code)) throw new ApplyCodeNotQuoteError(code);
  const resultState = await evalAst(astOfQuote(code), nestState(state, state.pipeValue, envToRun(code, state.env)));
  return withPipeValue(state, resultState.pipeValue);
});

bindPrim('parse', parseOperand);
bindPrim('apply', applyOperand);

// `parse` / `apply` — the codeAsData ring closer.
//
//   parse(source-string) → AST-Map      (the `read` primitive)
//   apply(code)          → pipeValue    (run an AST-or-Quote
//                                        against the subject)
//
// Together they round-trip qlang source text → data → pipeValue
// without leaving the language. `parse` lifts a string (or a
// Quote-value) into the AST-Map shape documented in
// `ast-codec.mjs`. `apply` runs the AST-or-Quote its captured arg
// answers against the subject, subject first like every other
// operand, so `x | apply(/)` runs a quote against itself and a trail
// replays as `error !| /trail | as(:t) | start | apply(t)`.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { nestState, withPipeValue } from '../state.mjs';
import { astNodeToMap, qlangMapToAst } from '../ast-codec.mjs';
import { isQMap, isQuote, isErrorValue } from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { evalAst } from '../eval.mjs';
import { parse as parseSource } from '../parse.mjs';
import { errorFromParse } from '../error-convert.mjs';

const ParseSubjectNotStringOrQuoteError = declareSubjectError(
  'ParseSubjectNotStringOrQuoteError', 'parse', ['string', 'quote']);

const ApplyCodeNotMapOrQuoteError = declareModifierError(
  'ApplyCodeNotMapOrQuoteError', 'apply', 2, ['map', 'quote']);

// `parse` — reads a source string into the AST-Map form documented
// in `ast-codec.mjs`. A Quote-value is accepted too: it is "code
// in string form", so `~{5 | mul(2)} | parse` reads the same as
// `"5 | mul(2)" | parse` minus the escape boilerplate. Malformed
// sources surface on the fail-track: the peggy `ParseError` is
// caught and converted to a qlang error value through
// `errorFromParse`, which stamps the `::ParseError` identity on the
// error's JS-header tag slot plus the peggy source location and
// excerpt onto the descriptor (the
// `::ParseError` tag-binding's catalog body carries
// `:category :parseError` for the broad-bucket reading via
// `result !| type | spec | /category`). The converted error
// becomes the new pipeValue directly without throwing — the
// evalNode fallback would route ParseError through `errorFromForeign`
// (yielding a host-shaped descriptor) and lose the parse-specific
// excerpt + expected/found fields a user-facing operand should
// preserve.
export const parseOperand = stateOp('parse', 1, async (state, _parseLambdas) => {
  const parseSrc = state.pipeValue;
  let sourceText;
  if (typeof parseSrc === 'string') sourceText = parseSrc;
  else if (isQuote(parseSrc))       sourceText = parseSrc.source;
  else throw new ParseSubjectNotStringOrQuoteError(parseSrc);
  try {
    const parsedAst = parseSource(sourceText, { uri: 'parse-operand' });
    return withPipeValue(state, astNodeToMap(parsedAst));
  } catch (parseErr) {
    return withPipeValue(state, errorFromParse(parseErr));
  }
});

// `astFromQuoteLike` — pulls the AST out of either a Quote-value
// (parse the Quote's source on demand, reusing the cached `.ast`
// if `evalDocSegments` already populated it) or an AST-Map (run
// it through `qlangMapToAst` to rebuild the JS-object AST shape
// peggy emits). A `ParseError` raised mid-parse rides out into the
// per-node fault-conversion seam in `evalNode`, which lifts it via
// `errorFromParse` to a `::ParseError!{…}` ErrorValue.
function astFromQuoteLike(value) {
  if (isQMap(value)) return qlangMapToAst(value);
  if (isQuote(value)) {
    return value.ast ?? parseSource(value.source, { uri: 'quote-source' });
  }
  throw new ApplyCodeNotMapOrQuoteError(value);
}

// `apply(code)` — runs the Quote-or-Map its captured arg answers
// against the subject, under the fork rule: the declarations the code
// makes stay inside it, and only its value comes out. A leading
// combinator (`~{* mul(2)}` / `~{!| /trail}`) routes the first
// step through that combinator, so a pipeline-suffix shape replays
// semantically. Code that is an error is that error, unchanged. The
// code runs one frame below the `apply` step, so a quote that
// applies itself descends a frame per re-entry until the depth
// budget lifts `EvaluationDepthExceededError`.
export const applyOperand = stateOp('apply', 2, async (state, applyLambdas) => {
  const code = await applyLambdas[0](state.pipeValue);
  if (isErrorValue(code)) return withPipeValue(state, code);
  const bodyAst = astFromQuoteLike(code);
  const resultState = await evalAst(bodyAst, nestState(state, state.pipeValue, state.env));
  return withPipeValue(state, resultState.pipeValue);
});

bindPrim('parse', parseOperand);
bindPrim('apply', applyOperand);

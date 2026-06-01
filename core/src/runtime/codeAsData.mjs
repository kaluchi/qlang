// `parse` / `eval` / `apply` — the codeAsData ring closer.
//
//   parse(source-string) → AST-Map      (the `read` primitive)
//   eval(ast-map)        → pipeValue    (the `eval` primitive)
//   apply(subject)       → pipeValue    (run an AST-or-Quote
//                                        against `subject` as the
//                                        initial pipeValue)
//
// Together they round-trip qlang source text → data → pipeValue
// without leaving the language. `parse` lifts a string (or a
// Quote-value) into the AST-Map shape documented in
// `ast-codec.mjs`. `eval` walks the AST-Map back into a JS-object
// AST and re-enters evaluation against the surrounding state.
// `apply` runs the AST-or-Quote sitting in `pipeValue` against
// the captured-arg subject — classical Lisp / JS `apply(fn, args)`
// convention. Trail-emitted suffix Quotes flow through `pipeValue`
// naturally, so `error !| /trail | apply(start)` re-runs the
// deflected steps against a fresh subject.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { makeState, withPipeValue } from '../state.mjs';
import { astNodeToMap, qlangMapToAst } from '../ast-codec.mjs';
import { isQMap, isQuote } from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { evalAst } from '../eval.mjs';
import { parse as parseSource } from '../parse.mjs';
import { errorFromParse } from '../error-convert.mjs';

const ParseSubjectNotStringOrQuoteError = declareSubjectError(
  'ParseSubjectNotStringOrQuoteError', 'parse', ['string', 'quote']);

const EvalSubjectNotMapOrQuoteError = declareSubjectError(
  'EvalSubjectNotMapOrQuoteError', 'eval', ['map', 'quote']);

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
// peggy emits). Throws `EvalSubjectNotMapOrQuoteError` when the
// value is neither shape; a `ParseError` raised mid-parse rides
// out into the per-node fault-conversion seam in `evalNode`,
// which lifts it via `errorFromParse` to a `::ParseError!{…}`
// ErrorValue.
function astFromQuoteLike(value) {
  if (isQMap(value)) return qlangMapToAst(value);
  if (isQuote(value)) {
    return value.ast ?? parseSource(value.source, { uri: 'quote-source' });
  }
  throw new EvalSubjectNotMapOrQuoteError(value);
}

// `eval` — runs an AST against the current state. Subject is
// either an AST-Map (the `parse` output, or a hand-constructed
// Map via `astNodeToMap`-style data assembly) or a Quote (raw
// qlang source in string form — parsed on the fly). The current
// `pipeValue` becomes the initial pipeValue of the inner
// evaluation, and `env` threads in unchanged: writes the inner
// code makes through `BindStep` / `as` land in `state.env` exactly
// as if the code had been inlined at the call site. The result is
// whatever `pipeValue` the inner code produces; env changes from
// inner BindStep / as / use calls propagate out, matching the
// semantics of a bare paren-group application.
export const evalOperand = stateOp('eval', 1, async (state, _evalLambdas) => {
  return await evalAst(astFromQuoteLike(state.pipeValue), state);
});

// `apply(subject)` — runs the Quote-or-Map in `pipeValue` against
// the captured-arg `subject` as the initial pipeValue. The Quote's
// leading combinator (if any — `~{* mul(2)}` / `~{| count}` /
// `~{>> sort}` / `~{!| /trail}`) routes the first step through
// that combinator against the new subject, so a pipeline-suffix
// shape replays semantically.
export const applyOperand = stateOp('apply', 2, async (state, applyLambdas) => {
  const bodyAst = astFromQuoteLike(state.pipeValue);
  const newSubject = await applyLambdas[0](state.pipeValue);
  const innerState = makeState(newSubject, state.env);
  const resultState = await evalAst(bodyAst, innerState);
  // Propagate inner env changes (BindStep / as / use writes inside
  // the applied body) outward, matching the `eval` semantics.
  return makeState(resultState.pipeValue, resultState.env);
});

bindPrim('parse', parseOperand);
bindPrim('eval',  evalOperand);
bindPrim('apply', applyOperand);

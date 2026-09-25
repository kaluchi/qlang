// The error operand: `error` lifts a Map into an error value. Bare
// form `map | error` uses pipeValue as the descriptor; full form
// `error map` resolves the captured-arg lambda against pipeValue as
// context.
//
// Error-track dispatch is owned by the `!|` combinator in eval.mjs.
// The operand carries no runtime flag distinguishing "error aware"
// from ordinary operands; the combinator is the sole mechanism that
// decides which track fires its step, so whether a value is an error
// reads as `false !| true`.
//
// Meta lives in lib/qlang/operand/error.qlang.

import { makeFn } from '../rule10.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isQMap, isErrorValue, isTagKeyword, makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const ErrorDescriptorNotMapError = declareSubjectError(
  'ErrorDescriptorNotMapError', 'error', 'map');

// error — lift a Map into an error value.
// Arity 1: bare `map | error` uses pipeValue as the descriptor;
// full form `error map` evaluates the captured-arg lambda against
// pipeValue as context and uses the result as the descriptor.
// Tag identity resolution rides the same uniform channel every
// tagged value-class uses:
//   1. JS-header `TAG_HEADER_SYMBOL` slot on the source Map —
//      covers the `!|`-materialized descriptor round-trip
//      (`error !| ... | error` preserves identity through the
//      Map view's header).
//   2. `:kind ::TagName` entry where the value is a TagKeyword
//      — covers literal user descriptors `{:kind ::Foo …} |
//      error`. Lifted to the header, dropped from the descriptor.
//   3. The kind of errors, `::error` — covers Map descriptors without
//      either form. A non-TagKeyword `:kind` value stays in the
//      descriptor as ordinary data.
export const error = makeFn('error', 1, async (state, errorLambdas) => {
  const sourceMap = errorLambdas.length === 0
    ? state.pipeValue
    : await errorLambdas[0](state.pipeValue);
  // Fail-track propagation: a descriptor-lambda that itself raised
  // an ErrorValue rides through `error` unchanged. Without this
  // pass-through the next branch would throw a generic
  // `ErrorDescriptorNotMapError` and bury the original cause.
  if (isErrorValue(sourceMap)) return withPipeValue(state, sourceMap);
  if (!isQMap(sourceMap)) {
    throw new ErrorDescriptorNotMapError(sourceMap);
  }
  let tag = sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const descriptor = new Map();
  for (const [k, v] of sourceMap) {
    if (k === 'kind' && isTagKeyword(v) && tag === ERROR_TAG) {
      tag = v;
      continue;
    }
    descriptor.set(k, v);
  }
  return withPipeValue(state, makeErrorValue(tag, descriptor));
}, { captured: [0, 1] });

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('error', error);

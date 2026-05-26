// Error operands: `error` and `isError`.
//
// `error` lifts a Map into an error value. Bare form `map | error`
// uses pipeValue as the descriptor; full form `error(map)` resolves
// the captured-arg lambda against pipeValue as context.
//
// `isError` is a plain predicate over pipeValue. In normal pipeline
// position it only ever sees a success-track value — because the `|`
// combinator deflects on an error before isError could fire — so it
// is primarily useful as a raw first-step operand inside lambdas
// passed to higher-order operands (`filter(isError)`, `any(isError)`,
// `every(isError | not)`, `* isError`), where the per-element
// sub-pipeline's first step runs without combinator dispatch and
// therefore sees the per-element pipeValue directly, whether it is
// an error or not.
//
// Error-track dispatch is owned by the `!|` combinator in eval.mjs.
// Neither operand carries any runtime flag distinguishing "error
// aware" from ordinary operands; the combinator is the sole
// mechanism that decides which track fires its step.
//
// Meta lives in lib/qlang/operand/reflective.qlang.

import { makeFn } from '../rule10.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isQMap, isErrorValue, isTagKeyword, makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL
} from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { nullaryOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';

const ErrorDescriptorNotMapError = declareSubjectError(
  'ErrorDescriptorNotMapError', 'error', 'map');

// error — lift a Map into an error value.
// Arity 1: bare `map | error` uses pipeValue as the descriptor;
// full form `error(map)` evaluates the captured-arg lambda against
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
//   3. Default `::Error` tag — covers Map descriptors without
//      either form. A non-TagKeyword `:kind` value stays in the
//      descriptor as ordinary data.
export const error = makeFn('error', 1, async (state, errorLambdas) => {
  const sourceMap = errorLambdas.length === 0
    ? state.pipeValue
    : await errorLambdas[0](state.pipeValue);
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

// isError — plain predicate. Returns true when pipeValue is an
// error value, false otherwise.
export const isError = nullaryOp('isError', (subject) => isErrorValue(subject));

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('error',   error);
bindPrim('isError', isError);

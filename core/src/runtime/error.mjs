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
// Meta lives in lib/qlang/core.qlang.

import { makeFn } from '../rule10.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isQMap, isErrorValue, describeType, makeErrorValue, keyword
} from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { nullaryOp } from './dispatch.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const ErrorDescriptorNotMap = declareSubjectError(
  'ErrorDescriptorNotMap', 'error', 'Map');

// error — lift a Map into an error value.
// Arity 1: bare `map | error` uses pipeValue as the descriptor;
// full form `error(map)` evaluates the captured-arg lambda against
// pipeValue as context and uses the result as the descriptor.
export const error = makeFn('error', 1, async (state, errorLambdas) => {
  const errorDescriptor = errorLambdas.length === 0
    ? state.pipeValue
    : await errorLambdas[0](state.pipeValue);
  if (!isQMap(errorDescriptor)) {
    throw new ErrorDescriptorNotMap(describeType(errorDescriptor), errorDescriptor);
  }
  return withPipeValue(state, makeErrorValue(errorDescriptor));
}, { captured: [0, 1] });

// isError — plain predicate. Returns true when pipeValue is an
// error value, false otherwise.
export const isError = nullaryOp('isError', (subject) => isErrorValue(subject));

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/error'),   error);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/isError'), isError);

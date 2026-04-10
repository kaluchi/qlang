// Error operands: error, catch, isError.
//
// `error` — valueOp arity 1: wraps a Map as an error value.
// `catch` — stateOpVariadic [0,1]: error-aware, unwraps error
//           to descriptor Map. Bare = unwrap. With handler = unwrap
//           + apply handler to descriptor.
// `isError` — nullary error-aware: returns boolean.
//
// `catch` and `isError` are the only error-aware operands in
// langRuntime. Their function values carry `errorAware: true`
// which evalNode checks during propagation.
//
// Meta lives in manifest.qlang.

import { makeFn } from '../rule10.mjs';
import { withPipeValue, makeState } from '../state.mjs';
import {
  isQMap, isErrorValue, describeType, keyword,
  makeErrorValue, materializeTrail
} from '../types.mjs';
import { declareSubjectError, declareArityError } from './operand-errors.mjs';

const ErrorDescriptorNotMap = declareSubjectError(
  'ErrorDescriptorNotMap', 'error', 'Map');
const IsErrorNoCapturedArgs = declareArityError('IsErrorNoCapturedArgs',
  ({ actualCount }) => `isError takes no arguments, got ${actualCount}`);

// error — create an error value from a Map descriptor.
// Arity 1: bare `map | error` or full `error(map)`.
export const error = (() => {
  const fn = makeFn('error', 1, (state, lambdas) => {
    const k = lambdas.length;
    const pv = state.pipeValue;
    let descriptor;
    if (k === 0) {
      descriptor = pv;
    } else {
      descriptor = lambdas[0](pv);
    }
    if (!isQMap(descriptor)) {
      throw new ErrorDescriptorNotMap(describeType(descriptor), descriptor);
    }
    return withPipeValue(state, makeErrorValue(descriptor, { location: null }));
  }, { captured: [0, 1] });
  return fn;
})();

// catch — error-aware operand. Unwraps error to descriptor Map.
// Bare (0 captured): unwrap error → Map. Non-error → pass through.
// With handler (1 captured): unwrap → run handler on Map. Non-error → pass through.
export const catchOp = (() => {
  const fn = makeFn('catch', 2, (state, lambdas) => {
    if (!isErrorValue(state.pipeValue)) {
      return state; // pass through non-error
    }
    // Unwrap: materialize trail into descriptor, produce a plain Map
    const descriptor = new Map(state.pipeValue.descriptor);
    descriptor.set(keyword('trail'), materializeTrail(state.pipeValue));
    if (lambdas.length === 0) {
      return withPipeValue(state, descriptor);
    }
    // Handler: evaluate against the descriptor Map
    const handlerResult = lambdas[0](descriptor);
    return withPipeValue(state, handlerResult);
  }, { captured: [0, 1] });
  // Mark as error-aware so evalNode propagation doesn't skip it
  return Object.freeze({ ...fn, errorAware: true });
})();

// isError — error-aware predicate. Returns true for error values.
export const isError = (() => {
  const fn = makeFn('isError', 1, (state, lambdas) => {
    if (lambdas.length !== 0) {
      throw new IsErrorNoCapturedArgs({ actualCount: lambdas.length });
    }
    return withPipeValue(state, isErrorValue(state.pipeValue));
  }, { captured: [0, 0] });
  return Object.freeze({ ...fn, errorAware: true });
})();

// Rule 10 — operand application protocol.
//
// Every function value in langRuntime has the uniform signature
//
//     fn(state, lambdas) → state
//
// The helpers in runtime/dispatch.mjs (valueOp, higherOrderOp,
// nullaryOp, overloadedOp) wrap pure `(values) → value` cores
// inside this signature: they project `state.pipeValue`, resolve
// captured-arg lambdas against it, call the pure core, and wrap
// the result back into a new state with `withPipeValue`.
//
// Reflective operands (env, use, future trace/snapshot/scope)
// use the `stateOp` helper, which does NOT descend to the value
// level — the impl receives the full state and returns a full
// state, giving it read/write access to `env`.
//
// Captured arguments are LAMBDAS, not pre-resolved values: each
// captured expression becomes an `(input) → value` closure that
// the operand impl can invoke zero, one, or many times, with
// whatever input the operand chooses. Higher-order operands like
// `filter` invoke the lambda per element; value operands like
// `mul` invoke it once against the subject (or the context, in
// full application).

import { ArityError } from './errors.mjs';

// applyRule10(fn, lambdas, state) → state
//
// Overflow check + dispatch. The arity of each helper-wrapped
// impl is enforced inside the helper; this function only blocks
// calls with more captured args than the function's declared
// maximum.
export function applyRule10(fn, lambdas, state) {
  if (lambdas.length > fn.arity) {
    throw new ArityError(
      `${fn.name} expects at most ${fn.arity - 1} captured arguments, got ${lambdas.length}`
    );
  }
  return fn.fn(state, lambdas);
}

// makeFn(name, arity, impl) → function value
//
// Wraps a state-transformer impl with the metadata Rule 10 needs.
// The impl signature is `(state, lambdas) → state`. Helpers from
// `runtime/dispatch.mjs` build value-core friendly wrappers on
// top of this base.
export function makeFn(name, arity, impl) {
  return Object.freeze({
    type: 'function',
    name,
    arity,
    fn: impl
  });
}

// `isFunctionValue` lives in types.mjs alongside the other
// value-class predicates. Callers that need it import it from
// there directly.

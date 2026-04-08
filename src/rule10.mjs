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
      `${fn.name} accepts at most ${fn.arity} captured arguments, got ${lambdas.length}`
    );
  }
  return fn.fn(state, lambdas);
}

// makeFn(name, arity, impl, meta) → function value
//
// Wraps a state-transformer impl with the metadata Rule 10 needs.
// The impl signature is `(state, lambdas) → state`. Helpers from
// `runtime/dispatch.mjs` build value-core friendly wrappers on
// top of this base.
//
// `meta` is an object carrying the operand's documentation and
// contract — read by `reify` to build descriptors. Required for
// every operand registered in `langRuntime`. Shape:
//   {
//     category:  string         // e.g. 'vec-reducer', 'arith'
//     subject:   string         // type label of the subject (pos 1)
//     modifiers: string[]       // type labels of captured arg slots
//     returns:   string         // type label of the result
//     docs:      string[]       // Vec of doc-block contents
//     examples:  string[]       // example query strings
//     throws:    string[]       // names of error sites this op raises
//   }
export function makeFn(name, arity, impl, meta) {
  return Object.freeze({
    type: 'function',
    name,
    arity,
    fn: impl,
    meta: Object.freeze(meta)
  });
}

// `isFunctionValue` lives in types.mjs alongside the other
// value-class predicates. Callers that need it import it from
// there directly.

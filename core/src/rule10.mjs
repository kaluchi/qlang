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
// Reflective operands (env, use, reify, manifest) use the
// `stateOp` / `stateOpVariadic` helpers, which do NOT descend to
// the value level — the impl receives the full state and returns
// a full state, giving it read/write access to `env`.
//
// Captured arguments are LAMBDAS: each captured expression becomes
// an `(input) → value` closure that the operand impl can invoke
// zero, one, or many times, with whatever input the operand
// chooses. Higher-order operands like
// `filter` invoke the lambda per element; value operands like
// `mul` invoke it once against the subject (or the context, in
// full application).

import { declareArityError } from './operand-errors.mjs';
import { classifyEffect } from './effect.mjs';

const Rule10ArityOverflowError = declareArityError('Rule10ArityOverflowError',
  ({ operandName, maxArity, actualArity }) =>
    `${operandName} accepts at most ${maxArity} captured arguments, got ${actualArity}`);

// applyRule10(fn, lambdas, state) → Promise<state>
//
// Overflow check + dispatch. The arity of each dispatch-wrapped
// impl is enforced inside the wrapper; this function only blocks
// calls with more captured args than the function's declared
// maximum.
export async function applyRule10(fn, appliedLambdas, state) {
  if (appliedLambdas.length > fn.arity) {
    throw new Rule10ArityOverflowError({
      operandName: fn.name,
      maxArity: fn.arity,
      actualArity: appliedLambdas.length
    });
  }
  return await fn.fn(state, appliedLambdas);
}

// makeFn(name, arity, impl, meta) → function value
//
// Wraps a state-transformer impl with the metadata Rule 10 needs.
// The impl signature is `(state, lambdas) → state`. Helpers from
// `runtime/dispatch.mjs` build value-core friendly wrappers on
// top of this base.
//
// `meta` carries only the per-impl structural fields the runtime
// itself reads. For the dispatch wrappers (`valueOp`,
// `higherOrderOp`, `nullaryOp`, `overloadedOp`, `stateOp`,
// `stateOpVariadic`, `higherOrderOpVariadic`) the shape is
// `{ captured: [min, max] }` — the [min, max] count of captured
// arg slots the operand accepts, derived structurally from the
// dispatch helper itself. Catalog-bound builtin descriptors keep
// their `category` / `subject` / `modifiers` / `returns` / `throws`
// fields on the authored `core/lib/qlang/**/*.qlang` Map; reify
// reads them through descriptor projection at every lookup, so the
// JS layer holds no duplicated authored meta.
//
// `makeConduitParameter` (in `eval.mjs`) is the lone JS-side
// builder that mints a function value WITH a full meta shape
// inline — conduit-parameter proxies are ephemeral, live only
// for the duration of a conduit body fork, and have no catalog
// entry to project meta from. The proxy's full meta lets the
// `isFunctionValue` branch of `reify`'s `describeBinding` build
// a `:kind :builtin` descriptor for the proxy without a
// descriptor-Map round-trip.
export function makeFn(name, arity, impl, meta) {
  return Object.freeze({
    type: 'function',
    name,
    arity,
    fn: impl,
    meta: Object.freeze(meta),
    effectful: classifyEffect(name)
  });
}

// `isFunctionValue` lives in types.mjs alongside the other
// value-class predicates. Callers that need it import it from
// there directly.

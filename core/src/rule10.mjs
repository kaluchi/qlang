// Rule 10 — operand application protocol.
//
// Every function value in langRuntime has the uniform signature
//
//     fn(state, lambdas) → state
//
// The one operand of the core built on it is the loader's `use`,
// through `stateOpVariadic` in runtime/dispatch.mjs: the impl receives
// the full state and returns a full state, writing the scope [D79];
// every other operand is a verb whose head the runtime executes.
//
// Captured arguments are LAMBDAS: each captured expression becomes
// an `(input) → value` closure that the operand impl can invoke
// zero, one, or many times, with whatever input the operand
// chooses. Higher-order operands like
// `filter` invoke the lambda per element; value operands like
// `mul` invoke it once against the subject (or the context, in
// full application).

import { declareArityError } from './errors.mjs';
import { classifyEffect } from './effect.mjs';
import { brandValueClass } from './types.mjs';

const Rule10ArityOverflowError = declareArityError('Rule10ArityOverflowError',
  ({ operandName, maxArity, actualArity }) =>
    `${operandName} accepts at most ${maxArity} captured arguments, got ${actualArity}`,
  { operand: '::call' });

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
// The impl signature is `(state, lambdas) → state`.
//
// `meta` carries only the per-impl structural fields the runtime
// itself reads, `{ captured: [min, max] }` — the [min, max] count of
// captured arg slots the operand accepts. Catalog-bound builtin descriptors keep
// their `category` / `subject` / `modifiers` / `returns` / `throws`
// fields on the authored `core/lib/qlang/**/*.qlang` Map; `manifest`
// reads them through descriptor projection at enumeration time, so
// the JS layer holds no duplicated authored meta.
export function makeFn(name, arity, impl, meta) {
  return Object.freeze(brandValueClass({
    name,
    arity,
    fn: impl,
    meta: Object.freeze(meta),
    effectful: classifyEffect(name)
  }, 'function'));
}

// `isFunctionValue` lives in types.mjs alongside the other
// value-class predicates. Callers that need it import it from
// there directly.

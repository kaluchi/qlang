// Rule 10 — operand application protocol.
//
// Every function value in langRuntime has the uniform signature
//
//     fn(state, lambdas) → state
//
// The one operand of the core built on it is the loader's `use`,
// through `stateOpVariadic` in runtime/dispatch.mjs: the impl receives
// the full state and returns a full state, writing the scope [D79];
// every other operand is a verb whose head the runtime executes. Each
// modifier reaches the impl as a lambda, `(input) → value`.

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

// makeFn(name, arity, impl, meta) → a function value over
// `(state, lambdas) → state`, `meta.captured` the [min, max] count of
// modifiers it takes.
export function makeFn(name, arity, impl, meta) {
  return Object.freeze(brandValueClass({
    name,
    arity,
    fn: impl,
    meta: Object.freeze(meta),
    effectful: classifyEffect(name)
  }, 'function'));
}

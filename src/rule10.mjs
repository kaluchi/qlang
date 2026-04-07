// Rule 10 — operand application.
//
// Captured arguments are LAMBDAS, not pre-resolved values:
// each captured arg is a closure (input) → value that, when
// called, evaluates the original sub-pipeline against the given
// input. This lets higher-order operands like `filter` invoke
// the lambda per element, while value-style operands like `mul`
// invoke it once with the operand's context.
//
// A function value carries metadata:
//   { type: 'function', name, arity, fn, pseudo? }
//
// The impl receives the operand's pipeValue (context) and an
// array of captured-arg lambdas. It decides how many lambdas it
// needs (partial vs full) and what input to pass each one.
//
// Pseudo-operands (such as `env`) bypass Rule 10 entirely:
// the evaluator detects `pseudo: true` and invokes the impl with
// the full state pair instead. See eval.mjs::evalOperandCall.

import { ArityError } from './errors.mjs';

// applyRule10(fn, lambdas, pipeValue) → result
//
// `fn`        — function value (carries arity, name, impl).
// `lambdas`   — array of (input → value) closures.
// `pipeValue` — current pipeValue at the apply site (the context).
export function applyRule10(fn, lambdas, pipeValue) {
  const k = lambdas.length;
  const n = fn.arity;

  if (k > n) {
    throw new ArityError(
      `${fn.name} expects at most ${n} captured arguments, got ${k}`
    );
  }

  return fn.fn(pipeValue, lambdas);
}

// makeFn(name, arity, impl, options?) → function value
//
// Wraps a JS function with the metadata Rule 10 needs. The impl
// signature for normal operands is `(pipeValue, lambdas) → result`;
// pseudo-operands receive the full state and return a new state.
//
// `options`:
//   pseudo — if true, the evaluator routes the call to the impl
//            with the full state instead of going through Rule 10.
export function makeFn(name, arity, impl, { pseudo = false } = {}) {
  return Object.freeze({
    type: 'function',
    name,
    arity,
    fn: impl,
    pseudo
  });
}

// `isFunctionValue` lives in types.mjs alongside the other
// value-class predicates. Callers that need it import it from
// there directly.

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
//   { type: 'function', name, arity, fn: (pipeValue, lambdas) → result }
//
// The impl receives the operand's pipeValue (context) and an
// array of captured-arg lambdas. It decides how many lambdas it
// needs (partial vs full) and what input to pass each one.

import { ArityError } from './errors.mjs';

// applyRule10(fn, lambdas, pipeValue) → result
//
// `fn`        — function value (carries arity, name, fn impl).
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

// makeFn(name, arity, impl) → function value
//
// Wraps a JS function with the metadata Rule 10 needs. The impl
// signature is `(pipeValue, lambdas) → result`. It is responsible
// for dispatching on `lambdas.length` (partial vs full) and for
// choosing what input to pass each lambda.
export function makeFn(name, arity, impl) {
  return Object.freeze({
    type: 'function',
    name,
    arity,
    fn: impl
  });
}

export function isFunctionValue(v) {
  return v !== null && typeof v === 'object' && v.type === 'function';
}

// constLambda(value) — wraps a literal as a lambda. Used in tests
// and any place where we want to pass a value as a captured arg
// from JS code rather than from the parser.
export function constLambda(value) {
  return () => value;
}

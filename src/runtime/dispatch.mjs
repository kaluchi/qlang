// Dispatch helpers for operand impls.
//
// Every function value installed in langRuntime has the uniform
// signature `(state, lambdas) → state`. The helpers in this file
// wrap pure cores so most operands do not need to touch state
// directly — they keep writing value-level impls, and the helper
// performs the state descent (extract pipeValue) and ascent
// (withPipeValue) on their behalf.
//
//   valueOp(name, n, impl)       — pure `(slot1..slotN) → result`
//     Partial (k = n - 1): subject = pipeValue, modifiers resolved
//     against pipeValue.
//     Full (k = n): all slots resolved against pipeValue as context.
//
//   higherOrderOp(name, n, impl) — pure `(subject, ...lambdas) → result`
//     Subject is always pipeValue. Captured lambdas are passed
//     UNRESOLVED so the impl can invoke them per-element.
//
//   nullaryOp(name, impl)        — pure `(subject) → result`
//     Arity 1, no captured args allowed.
//
//   overloadedOp(name, maxArity, impls)
//     Dispatches by captured-arg count. Each impl receives
//     `(pipeValue, ...lambdas) → result`.
//
//   stateOp(name, arity, impl)   — raw `(state, lambdas) → state`
//     No pipeValue extraction, no result wrapping. Used for
//     reflective operands (env, use) that must read or write the
//     full state. Enforces the captured-arg count exactly.
//
// The first four descend to the value level for the impl body
// and ascend back afterwards. `stateOp` stays on the state level
// throughout — the "descent and ascent" are no-ops.

import { makeFn } from '../rule10.mjs';
import { withPipeValue } from '../state.mjs';
import { QlangInvariantError } from '../errors.mjs';
import { declareArityError } from './operand-errors.mjs';
import { keyword } from '../types.mjs';

// Per-site arity error classes for dispatch helpers.
const ValueOpArityMismatch = declareArityError('ValueOpArityMismatch',
  ({ operandName, expectedArity, actualArity }) =>
    `${operandName} expects ${expectedArity - 1} or ${expectedArity} captured args, got ${actualArity}`);
const HigherOrderOpArityMismatch = declareArityError('HigherOrderOpArityMismatch',
  ({ operandName, expectedCaptured, actualArity }) =>
    `${operandName} expects ${expectedCaptured} captured args (higher-order), got ${actualArity}`);
const NullaryOpArgsProvided = declareArityError('NullaryOpArgsProvided',
  ({ operandName, actualArity }) =>
    `${operandName} takes no arguments, got ${actualArity}`);
const OverloadedOpUnsupportedArity = declareArityError('OverloadedOpUnsupportedArity',
  ({ operandName, supportedCounts, actualArity }) =>
    `${operandName} accepts ${supportedCounts} captured args, got ${actualArity}`);
const StateOpArityMismatch = declareArityError('StateOpArityMismatch',
  ({ operandName, expectedCaptured, actualArity }) =>
    `${operandName} expects ${expectedCaptured} captured args, got ${actualArity}`);

// Unbounded-upper-limit sentinel for variadic operand `captured`
// ranges. Surfaced into reify descriptors as a keyword value so
// user code can pattern-match with `eq(:unbounded)`.
export const UNBOUNDED = keyword('unbounded');

// ── Per-site invariant errors for variadic registration ───────
//
// These fire at langRuntime assembly time when a runtime-module
// author forgets to supply `meta.captured` on a variadic operand.
// Each helper's guard throws its own unique subclass so the stack
// trace and class name identify the exact registration site that
// violated the contract.

class StateOpVariadicMissingCaptured extends QlangInvariantError {
  constructor(operandName) {
    super(
      `stateOpVariadic('${operandName}') requires meta.captured`,
      { site: 'StateOpVariadicMissingCaptured', operandName }
    );
    this.name = 'StateOpVariadicMissingCaptured';
    this.fingerprint = 'StateOpVariadicMissingCaptured';
  }
}

class HigherOrderOpVariadicMissingCaptured extends QlangInvariantError {
  constructor(operandName) {
    super(
      `higherOrderOpVariadic('${operandName}') requires meta.captured`,
      { site: 'HigherOrderOpVariadicMissingCaptured', operandName }
    );
    this.name = 'HigherOrderOpVariadicMissingCaptured';
    this.fingerprint = 'HigherOrderOpVariadicMissingCaptured';
  }
}

// Helper: stamp the auto-inferred `captured` range onto user-supplied
// meta. Fixed-arity helpers (valueOp, higherOrderOp, nullaryOp,
// overloadedOp) always know the acceptable range from their `n` /
// `arity` / `impls` parameter, so callers never need to repeat it
// in meta. Variadic helpers (stateOpVariadic, higherOrderOpVariadic)
// cannot infer the range and require meta.captured directly — they
// bypass this helper.
function withCaptured(meta, captured) {
  return { ...meta, captured };
}

export function valueOp(name, n, impl, meta) {
  // Accepts n-1 (partial) or n (full) captured args.
  const capturedRange = [n - 1, n];
  return makeFn(name, n, (state, lambdas) => {
    const k = lambdas.length;
    const pv = state.pipeValue;
    if (k === n - 1) {
      // Partial: subject = pipeValue, modifiers resolved against pipeValue.
      const modifiers = lambdas.map(lam => lam(pv));
      return withPipeValue(state, impl(pv, ...modifiers));
    }
    if (k === n) {
      // Full: every slot from a captured lambda, resolved against pipeValue.
      const slots = lambdas.map(lam => lam(pv));
      return withPipeValue(state, impl(...slots));
    }
    throw new ValueOpArityMismatch({
      operandName: name, expectedArity: n, actualArity: k
    });
  }, withCaptured(meta, capturedRange));
}

export function higherOrderOp(name, n, impl, meta) {
  // Accepts exactly n-1 captured args.
  const capturedRange = [n - 1, n - 1];
  return makeFn(name, n, (state, lambdas) => {
    const k = lambdas.length;
    if (k === n - 1) {
      // Subject is pipeValue; modifiers stay unresolved (lambdas).
      return withPipeValue(state, impl(state.pipeValue, ...lambdas));
    }
    throw new HigherOrderOpArityMismatch({
      operandName: name, expectedCaptured: n - 1, actualArity: k
    });
  }, withCaptured(meta, capturedRange));
}

// nullaryOp(name, impl, meta) — arity 1, no captured args, subject = pipeValue.
export function nullaryOp(name, impl, meta) {
  return makeFn(name, 1, (state, lambdas) => {
    if (lambdas.length !== 0) {
      throw new NullaryOpArgsProvided({ operandName: name, actualArity: lambdas.length });
    }
    return withPipeValue(state, impl(state.pipeValue));
  }, withCaptured(meta, [0, 0]));
}

// overloadedOp(name, maxArity, impls, meta) — operand that supports
// multiple discrete arities. `impls` is an object keyed by
// captured-arg count: e.g. { 0: naturalImpl, 1: keyedImpl } for
// `sort` (bare natural order vs sort by key). Each impl receives
// `(pipeValue, ...lambdas)` → pure value result.
//
// `maxArity` controls Rule 10's overflow check; pass the largest
// supported (capturedCount + 1).
export function overloadedOp(name, maxArity, impls, meta) {
  const keys = Object.keys(impls).map(Number).sort((a, b) => a - b);
  const capturedRange = [keys[0], keys[keys.length - 1]];
  return makeFn(name, maxArity, (state, lambdas) => {
    const k = lambdas.length;
    const impl = impls[k];
    if (!impl) {
      throw new OverloadedOpUnsupportedArity({
        operandName: name,
        supportedCounts: Object.keys(impls).join(' or '),
        actualArity: k
      });
    }
    return withPipeValue(state, impl(state.pipeValue, ...lambdas));
  }, withCaptured(meta, capturedRange));
}

// stateOp(name, arity, impl, meta) — raw state transformer. The impl
// receives the full state pair and must return a new state. Use
// this for reflective operands that need to read or write env
// (env, use, reify, manifest).
//
// `arity` is enforced exactly: the captured-arg count must match
// `arity - 1` (one slot is the implicit subject). Pass 1 for
// "consumes pipeValue, no captured args" (env, use).
export function stateOp(name, arity, impl, meta) {
  const expected = arity - 1;
  return makeFn(name, arity, (state, lambdas) => {
    if (lambdas.length !== expected) {
      throw new StateOpArityMismatch({
        operandName: name, expectedCaptured: expected, actualArity: lambdas.length
      });
    }
    return impl(state, lambdas);
  }, withCaptured(meta, [expected, expected]));
}

// stateOpVariadic(name, maxArity, impl, meta) — like stateOp but
// accepts a range of captured-arg counts. The impl is responsible
// for dispatching by lambdas.length. Used by `reify`, which has a
// 0-captured value-level form and a 1-captured named form.
//
// `meta.captured` must be set explicitly by the caller — the helper
// has no way to infer the acceptable range from `impl` alone. Pass
// a `[min, max]` Vec where `max` can be the `UNBOUNDED` sentinel
// for unbounded upper limit.
export function stateOpVariadic(name, maxArity, impl, meta) {
  if (!meta || !meta.captured) {
    throw new StateOpVariadicMissingCaptured(name);
  }
  return makeFn(name, maxArity, (state, lambdas) => {
    return impl(state, lambdas);
  }, meta);
}

// higherOrderOpVariadic(name, maxArity, impl, meta) — like
// higherOrderOp but accepts a variable number of captured args
// (lambdas). Subject is always pipeValue; lambdas are passed
// unresolved so the impl can invoke them lazily and selectively.
// The impl is responsible for any min-arity check (Rule 10 only
// enforces the maxArity ceiling). Used by control-flow operands
// like coalesce that take 1+ alternative sub-pipelines.
//
// `meta.captured` must be set explicitly by the caller, same
// contract as `stateOpVariadic`.
export function higherOrderOpVariadic(name, maxArity, impl, meta) {
  if (!meta || !meta.captured) {
    throw new HigherOrderOpVariadicMissingCaptured(name);
  }
  return makeFn(name, maxArity, (state, lambdas) => {
    return withPipeValue(state, impl(state.pipeValue, ...lambdas));
  }, meta);
}

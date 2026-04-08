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
import { ArityError } from '../errors.mjs';

export function valueOp(name, n, impl, meta) {
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
    throw new ArityError(
      `${name} expects ${n - 1} or ${n} captured args, got ${k}`
    );
  }, meta);
}

export function higherOrderOp(name, n, impl, meta) {
  return makeFn(name, n, (state, lambdas) => {
    const k = lambdas.length;
    if (k === n - 1) {
      // Subject is pipeValue; modifiers stay unresolved (lambdas).
      return withPipeValue(state, impl(state.pipeValue, ...lambdas));
    }
    throw new ArityError(
      `${name} expects ${n - 1} captured args (higher-order), got ${k}`
    );
  }, meta);
}

// nullaryOp(name, impl, meta) — arity 1, no captured args, subject = pipeValue.
export function nullaryOp(name, impl, meta) {
  return makeFn(name, 1, (state, lambdas) => {
    if (lambdas.length !== 0) {
      throw new ArityError(`${name} takes no arguments, got ${lambdas.length}`);
    }
    return withPipeValue(state, impl(state.pipeValue));
  }, meta);
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
  return makeFn(name, maxArity, (state, lambdas) => {
    const k = lambdas.length;
    const impl = impls[k];
    if (!impl) {
      const supported = Object.keys(impls).join(' or ');
      throw new ArityError(
        `${name} accepts ${supported} captured args, got ${k}`
      );
    }
    return withPipeValue(state, impl(state.pipeValue, ...lambdas));
  }, meta);
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
  return makeFn(name, arity, (state, lambdas) => {
    const expected = arity - 1;
    if (lambdas.length !== expected) {
      throw new ArityError(
        `${name} expects ${expected} captured args, got ${lambdas.length}`
      );
    }
    return impl(state, lambdas);
  }, meta);
}

// stateOpVariadic(name, maxArity, impl, meta) — like stateOp but
// accepts a range of captured-arg counts. The impl is responsible
// for dispatching by lambdas.length. Used by `reify`, which has a
// 0-captured value-level form and a 1-captured named form.
export function stateOpVariadic(name, maxArity, impl, meta) {
  return makeFn(name, maxArity, (state, lambdas) => {
    return impl(state, lambdas);
  }, meta);
}

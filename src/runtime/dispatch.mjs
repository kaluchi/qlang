// Dispatch helpers for operand impls.
//
// Every function value installed in langRuntime has the uniform
// signature `(state, lambdas) → state`. The helpers in this file
// wrap pure cores so most operands do not need to touch state
// directly — they keep writing value-level impls, and the helper
// performs the state descent (extract pipeValue) and ascent
// (withPipeValue) on their behalf.
//
// None of the helpers accept operand meta (docs, examples, throws,
// category, subject, modifiers, returns). Meta lives exclusively
// in manifest.qlang and is attached by enrichWithManifest in
// runtime/index.mjs during langRuntime assembly. The only metadata
// the helpers compute is the `captured` range — the [min, max]
// count of captured args the operand accepts — because it is
// structurally derived from the dispatch shape, not from authored
// documentation.
//
//   valueOp(name, n, impl)           — pure `(slot1..slotN) → result`
//   higherOrderOp(name, n, impl)     — pure `(subject, ...lambdas) → result`
//   nullaryOp(name, impl)            — pure `(subject) → result`
//   overloadedOp(name, maxArity, impls) — dispatch by captured-arg count
//   stateOp(name, arity, impl)       — raw `(state, lambdas) → state`
//   stateOpVariadic(name, maxArity, impl, captured) — variadic state op
//   higherOrderOpVariadic(name, maxArity, impl, captured) — variadic higher-order

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

class StateOpVariadicMissingCaptured extends QlangInvariantError {
  constructor(operandName) {
    super(
      `stateOpVariadic('${operandName}') requires captured range`,
      { site: 'StateOpVariadicMissingCaptured', operandName }
    );
    this.name = 'StateOpVariadicMissingCaptured';
    this.fingerprint = 'StateOpVariadicMissingCaptured';
  }
}

class HigherOrderOpVariadicMissingCaptured extends QlangInvariantError {
  constructor(operandName) {
    super(
      `higherOrderOpVariadic('${operandName}') requires captured range`,
      { site: 'HigherOrderOpVariadicMissingCaptured', operandName }
    );
    this.name = 'HigherOrderOpVariadicMissingCaptured';
    this.fingerprint = 'HigherOrderOpVariadicMissingCaptured';
  }
}

export function valueOp(name, n, impl) {
  return makeFn(name, n, (state, lambdas) => {
    const k = lambdas.length;
    const pv = state.pipeValue;
    if (k === n - 1) {
      const modifiers = lambdas.map(lam => lam(pv));
      return withPipeValue(state, impl(pv, ...modifiers));
    }
    if (k === n) {
      const slots = lambdas.map(lam => lam(pv));
      return withPipeValue(state, impl(...slots));
    }
    throw new ValueOpArityMismatch({
      operandName: name, expectedArity: n, actualArity: k
    });
  }, { captured: [n - 1, n] });
}

export function higherOrderOp(name, n, impl) {
  return makeFn(name, n, (state, lambdas) => {
    const k = lambdas.length;
    if (k === n - 1) {
      return withPipeValue(state, impl(state.pipeValue, ...lambdas));
    }
    throw new HigherOrderOpArityMismatch({
      operandName: name, expectedCaptured: n - 1, actualArity: k
    });
  }, { captured: [n - 1, n - 1] });
}

export function nullaryOp(name, impl) {
  return makeFn(name, 1, (state, lambdas) => {
    if (lambdas.length !== 0) {
      throw new NullaryOpArgsProvided({ operandName: name, actualArity: lambdas.length });
    }
    return withPipeValue(state, impl(state.pipeValue));
  }, { captured: [0, 0] });
}

export function overloadedOp(name, maxArity, impls) {
  const keys = Object.keys(impls).map(Number).sort((a, b) => a - b);
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
  }, { captured: [keys[0], keys[keys.length - 1]] });
}

export function stateOp(name, arity, impl) {
  const expected = arity - 1;
  return makeFn(name, arity, (state, lambdas) => {
    if (lambdas.length !== expected) {
      throw new StateOpArityMismatch({
        operandName: name, expectedCaptured: expected, actualArity: lambdas.length
      });
    }
    return impl(state, lambdas);
  }, { captured: [expected, expected] });
}

export function stateOpVariadic(name, maxArity, impl, captured) {
  if (!captured) {
    throw new StateOpVariadicMissingCaptured(name);
  }
  return makeFn(name, maxArity, (state, lambdas) => {
    return impl(state, lambdas);
  }, { captured });
}

export function higherOrderOpVariadic(name, maxArity, impl, captured) {
  if (!captured) {
    throw new HigherOrderOpVariadicMissingCaptured(name);
  }
  return makeFn(name, maxArity, (state, lambdas) => {
    return withPipeValue(state, impl(state.pipeValue, ...lambdas));
  }, { captured });
}

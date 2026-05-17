// Dispatch wrappers for operand state transformers.
//
// Every function value installed in langRuntime has the uniform
// signature `(state, lambdas) → state`. The wrappers in this file
// bridge pure value-level cores so most operands do not need to
// touch state directly — they keep writing value-level impls, and
// the wrapper performs the state descent (extract pipeValue) and
// ascent (withPipeValue) on their behalf.
//
// None of the helpers accept operand meta (docs, examples, throws,
// category, subject, modifiers, returns). Meta lives in the per-
// family catalog files under lib/qlang/operand/<family>.qlang as
// descriptor Maps that langRuntime() parses into env. The only metadata
// helpers compute is the `captured` range — the [min, max] count
// of captured args the operand accepts — derived structurally
// from the dispatch shape itself.
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
import { declareArityError } from '../operand-errors.mjs';
import { keyword } from '../types.mjs';

// Per-site arity error classes for dispatch helpers.
const ValueOpArityMismatchError = declareArityError('ValueOpArityMismatchError',
  ({ operandName, expectedArity, actualArity }) =>
    `${operandName} expects ${expectedArity - 1} or ${expectedArity} captured args, got ${actualArity}`);
const HigherOrderOpArityMismatchError = declareArityError('HigherOrderOpArityMismatchError',
  ({ operandName, expectedCaptured, actualArity }) =>
    `${operandName} expects ${expectedCaptured} captured args (higher-order), got ${actualArity}`);
const NullaryOpArgsProvidedError = declareArityError('NullaryOpArgsProvidedError',
  ({ operandName, actualArity }) =>
    `${operandName} takes no arguments, got ${actualArity}`);
const OverloadedOpUnsupportedArityError = declareArityError('OverloadedOpUnsupportedArityError',
  ({ operandName, supportedCounts, actualArity }) =>
    `${operandName} accepts ${supportedCounts} captured args, got ${actualArity}`);
const StateOpArityMismatchError = declareArityError('StateOpArityMismatchError',
  ({ operandName, expectedCaptured, actualArity }) =>
    `${operandName} expects ${expectedCaptured} captured args, got ${actualArity}`);

// Unbounded-upper-limit sentinel for variadic operand `captured`
// ranges. Surfaced into manifest descriptors as a keyword value so
// user code can pattern-match with `eq(:unbounded)`.
export const UNBOUNDED = keyword('unbounded');

// ── Per-site invariant errors for variadic registration ───────

class StateOpVariadicMissingCapturedError extends QlangInvariantError {
  constructor(operandName) {
    super(
      `stateOpVariadic('${operandName}') requires captured range`,
      { operandName }
    );
    this.name = 'StateOpVariadicMissingCapturedError';
    this.fingerprint = 'StateOpVariadicMissingCapturedError';
  }
}

class HigherOrderOpVariadicMissingCapturedError extends QlangInvariantError {
  constructor(operandName) {
    super(
      `higherOrderOpVariadic('${operandName}') requires captured range`,
      { operandName }
    );
    this.name = 'HigherOrderOpVariadicMissingCapturedError';
    this.fingerprint = 'HigherOrderOpVariadicMissingCapturedError';
  }
}

export function valueOp(name, n, impl) {
  return makeFn(name, n, async (state, valueOpLambdas) => {
    const capturedCount = valueOpLambdas.length;
    const subjectValue = state.pipeValue;
    if (capturedCount === n - 1) {
      const resolvedModifiers = await Promise.all(valueOpLambdas.map(lam => lam(subjectValue)));
      return withPipeValue(state, await impl(subjectValue, ...resolvedModifiers));
    }
    if (capturedCount === n) {
      const resolvedSlots = await Promise.all(valueOpLambdas.map(lam => lam(subjectValue)));
      return withPipeValue(state, await impl(...resolvedSlots));
    }
    throw new ValueOpArityMismatchError({
      operandName: name, expectedArity: n, actualArity: capturedCount
    });
  }, { captured: [n - 1, n] });
}

export function higherOrderOp(name, n, impl) {
  return makeFn(name, n, async (state, hoLambdas) => {
    const capturedCount = hoLambdas.length;
    if (capturedCount === n - 1) {
      return withPipeValue(state, await impl(state.pipeValue, ...hoLambdas));
    }
    throw new HigherOrderOpArityMismatchError({
      operandName: name, expectedCaptured: n - 1, actualArity: capturedCount
    });
  }, { captured: [n - 1, n - 1] });
}

export function nullaryOp(name, impl) {
  return makeFn(name, 1, async (state, nullaryLambdas) => {
    if (nullaryLambdas.length !== 0) {
      throw new NullaryOpArgsProvidedError({ operandName: name, actualArity: nullaryLambdas.length });
    }
    return withPipeValue(state, await impl(state.pipeValue));
  }, { captured: [0, 0] });
}

export function overloadedOp(name, maxArity, overloadImpls) {
  const arityKeys = Object.keys(overloadImpls).map(Number).sort((a, b) => a - b);
  return makeFn(name, maxArity, async (state, overloadLambdas) => {
    const capturedCount = overloadLambdas.length;
    const selectedImpl = overloadImpls[capturedCount];
    if (!selectedImpl) {
      throw new OverloadedOpUnsupportedArityError({
        operandName: name,
        supportedCounts: Object.keys(overloadImpls).join(' or '),
        actualArity: capturedCount
      });
    }
    return withPipeValue(state, await selectedImpl(state.pipeValue, ...overloadLambdas));
  }, { captured: [arityKeys[0], arityKeys[arityKeys.length - 1]] });
}

export function stateOp(name, arity, impl) {
  const expectedCaptured = arity - 1;
  return makeFn(name, arity, async (state, stateOpLambdas) => {
    if (stateOpLambdas.length !== expectedCaptured) {
      throw new StateOpArityMismatchError({
        operandName: name, expectedCaptured, actualArity: stateOpLambdas.length
      });
    }
    return await impl(state, stateOpLambdas);
  }, { captured: [expectedCaptured, expectedCaptured] });
}

export function stateOpVariadic(name, maxArity, impl, captured) {
  if (!captured) {
    throw new StateOpVariadicMissingCapturedError(name);
  }
  return makeFn(name, maxArity, async (state, variadicLambdas) => {
    return await impl(state, variadicLambdas);
  }, { captured });
}

export function higherOrderOpVariadic(name, maxArity, impl, captured) {
  if (!captured) {
    throw new HigherOrderOpVariadicMissingCapturedError(name);
  }
  return makeFn(name, maxArity, async (state, hoVariadicLambdas) => {
    return withPipeValue(state, await impl(state.pipeValue, ...hoVariadicLambdas));
  }, { captured });
}

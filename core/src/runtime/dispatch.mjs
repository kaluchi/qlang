// Dispatch wrappers for operand state transformers.
//
// Every function value installed in langRuntime has the uniform
// signature `(state, lambdas) → state`. The wrappers in this file
// bridge pure value-level cores so most operands do not need to
// touch state directly — they keep writing value-level impls, and
// the wrapper performs the state descent (extract pipeValue) and
// ascent (withPipeValue) on their behalf.
//
// None of the wrappers accept authored meta (docs, examples,
// throws, category, subject, modifiers, returns). That metadata
// lives in the per-family catalog files under
// lib/qlang/operand/<family>.qlang as descriptor Maps that
// langRuntime() parses into env. The only structural fact each
// wrapper computes is the `captured` range — the [min, max] count
// of captured args the operand accepts — derived from the
// dispatch shape itself.
//
//   valueOp(name, n, impl)           — pure `(slot1..slotN) → result`
//   higherOrderOp(name, n, impl)     — pure `(subject, ...lambdas) → result`
//   nullaryOp(name, impl)            — pure `(subject) → result`
//   overloadedOp(name, maxArity, impls) — dispatch by captured-arg count
//   stateOp(name, arity, impl)       — raw `(state, lambdas) → state`
//   stateOpVariadic(name, maxArity, impl, captured) — variadic state op
//   higherOrderOpVariadic(name, maxArity, impl, captured) — variadic higher-order

import { makeFn } from '../rule10.mjs';
import { withPipeValue, envGet } from '../state.mjs';
import { QlangInvariantError } from '../errors.mjs';
import { declareArityError } from '../operand-errors.mjs';
import {
  keyword, isQMap, isSnapshot, isJsonArray,
  TAG_HEADER_SYMBOL, stampTagHeader
} from '../types.mjs';
import { tagBindingKey } from '../env-keys.mjs';
import { mintTaggedInstance } from '../eval.mjs';

// Per-site arity error classes for the dispatch wrappers.
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

// Tag preservation runs as a post-process pass when the operand
// declares `{ preservesTag: true }`. Identity-only tags stamp
// the header on the result; `:impl`-bearing tags re-invoke the
// constructor against the post-transform payload (the «invariant
// re-runs across transforms» contract). Operands opt in because
// shape-changing reducers (count, every, sum, …) drop the source
// tag naturally — the operand body knows whether its output is
// the same value-class as its input.
async function applyTagPreservation(state, source, result) {
  // Optional chaining on source handles the `null` pipeValue
  // case without an explicit guard — `null?.[Symbol]` yields
  // undefined and the early return below catches it. preservesTag
  // operands that throw on a null/non-sequence subject never
  // reach this post-pass anyway; the chaining is a single-line
  // safety on the principle that subject lookup is well-defined
  // across every JS value.
  const sourceTag = source?.[TAG_HEADER_SYMBOL];
  if (sourceTag === undefined) return result;
  let resolved = envGet(state.env, tagBindingKey(sourceTag.name));
  if (isSnapshot(resolved)) resolved = resolved.get('payload');
  if (isQMap(resolved) && resolved.has('impl')) {
    return await mintTaggedInstance(sourceTag.name, result, state);
  }
  if (result[TAG_HEADER_SYMBOL] === undefined) stampTagHeader(result, sourceTag);
  if (isJsonArray(result) && !Object.isFrozen(result)) Object.freeze(result);
  return result;
}

export function valueOp(name, n, impl, options = {}) {
  return makeFn(name, n, async (state, valueOpLambdas) => {
    const capturedCount = valueOpLambdas.length;
    const subjectValue = state.pipeValue;
    let raw;
    if (capturedCount === n - 1) {
      const resolvedModifiers = await Promise.all(valueOpLambdas.map(lam => lam(subjectValue)));
      raw = await impl(subjectValue, ...resolvedModifiers);
    } else if (capturedCount === n) {
      const resolvedSlots = await Promise.all(valueOpLambdas.map(lam => lam(subjectValue)));
      raw = await impl(...resolvedSlots);
    } else {
      throw new ValueOpArityMismatchError({
        operandName: name, expectedArity: n, actualArity: capturedCount
      });
    }
    const final = options.preservesTag
      ? await applyTagPreservation(state, subjectValue, raw)
      : raw;
    return withPipeValue(state, final);
  }, { captured: [n - 1, n] });
}

export function higherOrderOp(name, n, impl, options = {}) {
  return makeFn(name, n, async (state, hoLambdas) => {
    const capturedCount = hoLambdas.length;
    if (capturedCount !== n - 1) {
      throw new HigherOrderOpArityMismatchError({
        operandName: name, expectedCaptured: n - 1, actualArity: capturedCount
      });
    }
    const raw = await impl(state.pipeValue, ...hoLambdas);
    const final = options.preservesTag
      ? await applyTagPreservation(state, state.pipeValue, raw)
      : raw;
    return withPipeValue(state, final);
  }, { captured: [n - 1, n - 1] });
}

export function nullaryOp(name, impl, options = {}) {
  return makeFn(name, 1, async (state, nullaryLambdas) => {
    if (nullaryLambdas.length !== 0) {
      throw new NullaryOpArgsProvidedError({ operandName: name, actualArity: nullaryLambdas.length });
    }
    const raw = await impl(state.pipeValue);
    const final = options.preservesTag
      ? await applyTagPreservation(state, state.pipeValue, raw)
      : raw;
    return withPipeValue(state, final);
  }, { captured: [0, 0] });
}

export function overloadedOp(name, maxArity, overloadImpls, options = {}) {
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
    const raw = await selectedImpl(state.pipeValue, ...overloadLambdas);
    const final = options.preservesTag
      ? await applyTagPreservation(state, state.pipeValue, raw)
      : raw;
    return withPipeValue(state, final);
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

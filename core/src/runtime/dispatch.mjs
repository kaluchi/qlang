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

// `mintTaggedInstance` lives in `eval.mjs`, which depends on
// `runtime/index.mjs`, which depends on `runtime/control.mjs`,
// which depends on this file — a static import here would close
// a cycle and trip TDZ on `UNBOUNDED` whenever a consumer enters
// the graph through `runtime/dispatch.mjs` first (subpath import
// `@kaluchi/qlang-core/dispatch`). The dynamic form below resolves
// `eval.mjs` after every module in the cycle finishes initialising;
// Node caches the resolution after the first call.

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
  // JsonArray hardening — `containerLikeOf` returns the mint
  // unfrozen so the post-pass freezes after any header stamping.
  // Both the tagged and untagged exits go through `freezeIfJsonArray`
  // so freezing is not coupled to the tag-stamping path.
  // Optional chaining on source handles a `null` pipeValue safely
  // — `null?.[Symbol]` yields undefined and falls through here.
  const sourceTag = source?.[TAG_HEADER_SYMBOL];
  if (sourceTag === undefined) {
    freezeIfJsonArray(result);
    return result;
  }
  let resolved = envGet(state.env, tagBindingKey(sourceTag.name));
  if (isSnapshot(resolved)) resolved = resolved.get('payload');
  if (isQMap(resolved) && resolved.has('impl')) {
    const { mintTaggedInstance } = await import('../eval.mjs');
    return await mintTaggedInstance(sourceTag.name, result, state);
  }
  // `result[TAG_HEADER_SYMBOL]` reads safely through every
  // `preservesTag` return shape — those operands (filter / sort
  // / take / drop / reverse / flat / sortWith / distinct) always
  // produce composite Vec / Set / Map / JsonArray. A preserve-
  // path operand that returns a primitive surfaces the contract
  // bug as a TypeError at the operand site.
  if (result[TAG_HEADER_SYMBOL] === undefined) stampTagHeader(result, sourceTag);
  freezeIfJsonArray(result);
  return result;
}

function freezeIfJsonArray(value) {
  if (isJsonArray(value) && !Object.isFrozen(value)) Object.freeze(value);
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

function variadicMaxArity(captured) {
  const upper = captured[1];
  if (upper === UNBOUNDED) return Infinity;
  return upper;
}

export function stateOpVariadic(name, impl, captured) {
  if (!captured) {
    throw new StateOpVariadicMissingCapturedError(name);
  }
  return makeFn(name, variadicMaxArity(captured), async (state, variadicLambdas) => {
    return await impl(state, variadicLambdas);
  }, { captured });
}

export function higherOrderOpVariadic(name, impl, captured) {
  if (!captured) {
    throw new HigherOrderOpVariadicMissingCapturedError(name);
  }
  return makeFn(name, variadicMaxArity(captured), async (state, hoVariadicLambdas) => {
    return withPipeValue(state, await impl(state.pipeValue, ...hoVariadicLambdas));
  }, { captured });
}

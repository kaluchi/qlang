// State — the evaluator's (pipeValue, env) pair plus the depth budget.
//
// State is meta-notation: it lives only inside the evaluator.
// Users never see or construct it. Within the evaluator we model
// it as a frozen object carrying the semantic pair — `pipeValue`,
// `env` — and one bookkeeping field, `depth`: how many nested
// evaluation frames (verb bodies, modifiers run at a call, `apply`
// re-entry, Quote-bodied tag constructors, doc-segment
// literals, locator-loaded modules) sit between the root and this
// state. Every step returns a fresh State carrying the next
// pipeValue or the next env; the previous State stays observable
// to ancestor frames so fork boundaries can discard inner-env
// writes without copying.
//
// The env is a JS Map whose keys are plain strings (identifier
// names). Identifier lookup passes the name string directly.

import { EvaluationDepthExceededError } from './errors.mjs';
import { isModuleKey } from './env-keys.mjs';

// EVAL_DEPTH_LIMIT — deepest frame `nestState` admits. A verb
// that calls itself without a base case, a Quote that applies
// itself, a tag constructor that mints its own tag: each descends
// one frame per call and lifts `EvaluationDepthExceededError` on
// the frame past the budget, so the fail-track reports the runaway
// while the host's heap stays bounded.
export const EVAL_DEPTH_LIMIT = 1000;

function makeState(pipeValue, env, depth) {
  return Object.freeze({ pipeValue, env, depth });
}

// rootState(pipeValue, env) → State at depth 0 — the entry frame of
// a query, a session cell, a module load, the catalog bootstrap.
export function rootState(pipeValue, env) {
  return makeState(pipeValue, env, 0);
}

// withPipeValue(state, nextPipeValue) → State on the same frame
export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.env, state.depth);
}

// withEnv(state, nextEnv) → State on the same frame
export function withEnv(state, nextEnv) {
  return makeState(state.pipeValue, nextEnv, state.depth);
}

// nestState(state, pipeValue, env) → State one frame deeper, or
// EvaluationDepthExceededError once the frame passes
// EVAL_DEPTH_LIMIT. `context.depth` names the refused frame.
export function nestState(state, pipeValue, env) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) {
    throw new EvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  }
  return makeState(pipeValue, env, depth);
}

// envGet(env, name) → value or undefined
export function envGet(env, name) {
  return env.get(name);
}

// envHas(env, name) → boolean
export function envHas(env, name) {
  return env.has(name);
}

// What an env's loaded modules derive, computed once and shared by
// every env a step wrote from it without touching a module, so a
// lookup reads it instead of scanning the env.
const MODULE_DERIVED = new WeakMap();
const MODULES_FROM = new WeakMap();

export function moduleDerivedOf(env, derive) {
  let derived = MODULE_DERIVED.get(env);
  if (derived === undefined) {
    const source = MODULES_FROM.get(env);
    derived = source === undefined ? derive(env) : moduleDerivedOf(source, derive);
    MODULE_DERIVED.set(env, derived);
  }
  return derived;
}

function keepingDerived(from, to, writtenKeys) {
  if (!writtenKeys.some(isModuleKey)) MODULES_FROM.set(to, from);
  return to;
}

// envSet(env, name, value) → new env Map
export function envSet(env, name, value) {
  return keepingDerived(env, new Map(env).set(name, value), [name]);
}

// envMerge(env, otherMap) → new env Map
export function envMerge(env, otherMap) {
  const next = new Map(env);
  for (const [key, value] of otherMap) next.set(key, value);
  return keepingDerived(env, next, [...otherMap.keys()]);
}

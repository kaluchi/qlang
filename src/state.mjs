// State pair (pipeValue, env) helpers.
//
// State is meta-notation: it lives only inside the evaluator.
// Users never see or construct it. Within the evaluator we model
// it as a frozen object with two fields. Every step returns a new
// State; mutation is forbidden.
//
// The env is a JS Map whose keys are interned keyword objects
// (see types.mjs::keyword). Identifier lookup converts an
// identifier name string to its keyword via `keyword(name)`.
// Keeping env keyed by keywords makes the `env` operand interop
// cleanly with `has`, `keys`, `vals`, and `/key` projection —
// every Map in the language uses the same key type.

import { keyword } from './types.mjs';

// makeState(pipeValue, env) → State
export function makeState(pipeValue, env) {
  return Object.freeze({ pipeValue, env });
}

// withPipeValue(state, nextPipeValue) → new State
export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.env);
}

// withEnv(state, nextEnv) → new State
export function withEnv(state, nextEnv) {
  return makeState(state.pipeValue, nextEnv);
}

// envGet(env, name) → value or undefined
export function envGet(env, name) {
  return env.get(keyword(name));
}

// envHas(env, name) → boolean
export function envHas(env, name) {
  return env.has(keyword(name));
}

// envSet(env, name, value) → new env Map
//
// Returns a new env Map with the keyword for `name` mapped to
// `value`. The original env is untouched. Used by `as`, `let`,
// and `use`.
export function envSet(env, name, value) {
  return new Map(env).set(keyword(name), value);
}

// envMerge(env, otherMap) → new env Map
//
// Merges every entry of `otherMap` (a JS Map with keyword keys)
// into a fresh copy of `env`. On conflict, the incoming value
// wins.
export function envMerge(env, otherMap) {
  const next = new Map(env);
  for (const [key, value] of otherMap) next.set(key, value);
  return next;
}

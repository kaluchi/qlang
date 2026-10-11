// The state of the evaluator: the value in the pipe, the scope and the
// depth of the frames nested under the query; a step answers a new state,
// so a fork leaves the declarations of its inside behind by keeping the
// state it started from.
//
// The scope is a map from the names a reader declared to their records,
// the frame, over the root the host's sources declared, which sits under
// a key no name spells and is shared by every frame [D153]; a lookup
// reads the frame, then the root.

import { CallEvaluationDepthExceededError } from './errors.mjs';
import { ROOT_KEY } from './env-keys.mjs';

// The deepest frame `nestState` admits: a runaway, a word that calls
// itself without end, is refused on the frame past it, and the host's
// heap stays bounded.
export const EVAL_DEPTH_LIMIT = 1000;

function makeState(pipeValue, env, depth) {
  return { pipeValue, env, depth };
}

// rootState(pipeValue, env) → State at depth 0 — the entry frame of
// a query, a session cell, a source of the root.
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
// CallEvaluationDepthExceededError once the frame passes
// EVAL_DEPTH_LIMIT, its fact `:depth` the refused frame.
export function nestState(state, pipeValue, env) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) {
    throw new CallEvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  }
  return makeState(pipeValue, env, depth);
}

const NO_ROOT = new Map();

// rootOf(env) → the root beneath a frame, the bindings the host's
// sources declared.
export function rootOf(env) {
  return env.get(ROOT_KEY) ?? NO_ROOT;
}

// envGet(env, name) → the value the frame holds under a name, else the
// root's, or undefined
export function envGet(env, name) {
  return env.has(name) ? env.get(name) : rootOf(env).get(name);
}

// envHas(env, name) → boolean
export function envHas(env, name) {
  return env.has(name) || rootOf(env).has(name);
}

// envSet(env, name, value) → new env Map
export function envSet(env, name, value) {
  return new Map(env).set(name, value);
}

// envMerge(env, otherMap) → new env Map
export function envMerge(env, otherMap) {
  const next = new Map(env);
  for (const [key, value] of otherMap) next.set(key, value);
  return next;
}

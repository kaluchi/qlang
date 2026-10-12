// The state of the evaluator, the value in the pipe, the scope and the
// depth of the frames nested under the query, a new one at each step, so
// a fork leaves the declarations of its inside behind by keeping the
// state it started from; the scope maps the names a reader declared to
// their records, the frame, over the root the host's sources declared,
// under a key no name spells, a lookup reading the frame and then the
// root [D153].

import { CallEvaluationDepthExceededError } from './errors.mjs';
import { ROOT_KEY } from './env-keys.mjs';

// The deepest frame `nestState` admits: a runaway, a word that calls
// itself without end, is refused on the frame past it, and the host's
// heap stays bounded.
export const EVAL_DEPTH_LIMIT = 1000;

function makeState(pipeValue, env, depth) {
  return Object.freeze({ pipeValue, env, depth });
}

// rootState(pipeValue, env) → a state at depth 0, the first of a query, a
// cell of a session or a source of the root.
export function rootState(pipeValue, env) {
  return makeState(pipeValue, env, 0);
}

// withPipeValue(state, nextPipeValue) → a state at the same depth holding
// the value.
export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.env, state.depth);
}

// withEnv(state, nextEnv) → a state at the same depth holding the scope.
export function withEnv(state, nextEnv) {
  return makeState(state.pipeValue, nextEnv, state.depth);
}

// frameBelow(state) → the depth of the frame one below a state, or
// CallEvaluationDepthExceededError once it passes EVAL_DEPTH_LIMIT, its
// fact `:depth` the refused frame; a frame read with no state of its own
// meets the budget by it alone.
export function frameBelow(state) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) throw new CallEvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  return depth;
}

// nestState(state, pipeValue, env) → the state one frame below.
export function nestState(state, pipeValue, env) {
  return makeState(pipeValue, env, frameBelow(state));
}

const NO_ROOT = new Map();

// rootOf(env) → the root beneath a frame, the bindings the host's
// sources declared.
export function rootOf(env) {
  return env.get(ROOT_KEY) ?? NO_ROOT;
}

// envHas(env, name) → whether the frame or the root holds the name.
export function envHas(env, name) {
  return env.has(name) || rootOf(env).has(name);
}

// envSet(env, name, value) → a new scope, the name holding the value.
export function envSet(env, name, value) {
  return asScopeOf(env, new Map(env).set(name, value));
}

// The scopes of the words of the root, where a bare name and the
// definition of a call read the root alone [D23], and every scope made
// from one.
const ROOT_WORD_SCOPES = new WeakSet();

export function markRootWordScope(scope) {
  ROOT_WORD_SCOPES.add(scope);
  return scope;
}

export function isRootWordScope(scope) {
  return ROOT_WORD_SCOPES.has(scope);
}

export function asScopeOf(from, made) {
  return ROOT_WORD_SCOPES.has(from) ? markRootWordScope(made) : made;
}

// envMerge(env, otherMap) → a new scope, the names of the map over its own.
export function envMerge(env, otherMap) {
  const next = new Map(env);
  for (const [key, value] of otherMap) next.set(key, value);
  return asScopeOf(env, next);
}

// The state of the evaluator, the value in the pipe, the scope and the
// evaluation depth, a new state at each step, so a fork leaves the
// declarations of its inside behind by keeping the state it started from;
// the scope maps the names a reader declared to their records over the root
// the host's sources declared, under a key no name spells, a lookup reading
// the scope and then the root [QSDSP#residence], [D359].

import { CallEvaluationDepthExceededError } from './errors.mjs';
import { ROOT_KEY, QUERY_KEY } from './env-keys.mjs';

// The deepest evaluation depth `nestState` admits: a runaway, a verb that
// calls itself without end, is refused one deeper, and the host's heap stays
// bounded [D359].
export const EVAL_DEPTH_LIMIT = 1000;

// The calls a state runs within keep the origin of each quote they
// received, the nearest first, and a state a verb of the host reads keeps
// beside the tree of the query the scope of its own step [QSQUO#held], [QSNAM#owner].
function makeState(pipeValue, env, depth, calls = null, own = null) {
  return Object.freeze({ pipeValue, env, depth, calls, own });
}

// rootState(pipeValue, env) → a state at depth 0, the first of a query, a
// cell of a session or a source of the root.
export function rootState(pipeValue, env) {
  return makeState(pipeValue, env, 0);
}

// withPipeValue(state, nextPipeValue) → a state at the same depth holding
// the value.
export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.env, state.depth, state.calls);
}

// withEnv(state, nextEnv) → a state at the same depth holding the scope.
export function withEnv(state, nextEnv) {
  return makeState(state.pipeValue, nextEnv, state.depth, state.calls);
}

// depthBelow(state) → the evaluation depth one deeper than a state, or
// CallEvaluationDepthExceededError once it passes EVAL_DEPTH_LIMIT, its
// fact `:depth` the depth refused; a read that runs with no state of its
// own meets the limit by it alone [D359].
export function depthBelow(state) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) throw new CallEvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  return depth;
}

// nestState(state, pipeValue, env) → the state one deeper in the evaluation
// depth.
export function nestState(state, pipeValue, env) {
  return makeState(pipeValue, env, depthBelow(state), state.calls);
}

// withCall(state, origins) → the state of the run of a call, which keeps
// the origin of each quote the call received for the code run within it,
// before those of the calls around it [QSQUO#held].
export function withCall(state, origins) {
  return makeState(state.pipeValue, state.env, state.depth, { origins, around: state.calls }, state.own);
}

// originIn(state, quote) → the origin the nearest call around a state keeps
// for a quote, or undefined [QSQUO#held].
export function originIn(state, quote) {
  for (let call = state.calls; call !== null; call = call.around) {
    const origin = call.origins.get(quote);
    if (origin !== undefined) return origin;
  }
  return undefined;
}

// ownScopeOf(state) → the scope of the step a state runs, its own where a
// verb of the host reads the tree of the query [QSNAM#owner].
export function ownScopeOf(state) {
  return state.own ?? state.env;
}

const NO_ROOT = new Map();

// rootOf(env) → the root beneath a scope, the bindings the host's
// sources declared.
export function rootOf(env) {
  return env.get(ROOT_KEY) ?? NO_ROOT;
}

// envHas(env, name) → whether the scope or the root holds the name.
export function envHas(env, name) {
  return env.has(name) || rootOf(env).has(name);
}

// queryTreeOf(env) → the tree of names of the query a scope runs under:
// in the recipe of a verb, the tree of the query that called it, carried
// down through every verb the recipe calls, and elsewhere the scope itself.
// A verb of the host reads it at its call, while the names a recipe writes
// read the scope the recipe runs in, so a verb written in the language and
// a verb of the host read the same tree [QSNAM#owner].
export function queryTreeOf(env) {
  return env.get(QUERY_KEY) ?? env;
}

// queryStateOf(state) → the state as a verb of the host reads it at its
// call: its value and its depth over the tree of the query [QSNAM#owner].
export function queryStateOf(state) {
  const tree = queryTreeOf(state.env);
  return tree === state.env ? state : makeState(state.pipeValue, tree, state.depth, state.calls, state.env);
}

// envSet(env, name, value) → a new scope, the name holding the value; the
// recipe of a verb keeps its own names out of the tree of the query, as a
// verb of the host does [QSNAM#owner].
export function envSet(env, name, value) {
  return asScopeOf(env, new Map(env).set(name, value));
}

// The scopes of the verbs of the root, where a name under a noun of the
// root reads the root alone [QSNAM#owner], and every scope made from one.
const ROOT_VERB_SCOPES = new WeakSet();

export function markRootVerbScope(scope) {
  ROOT_VERB_SCOPES.add(scope);
  return scope;
}

export function isRootVerbScope(scope) {
  return ROOT_VERB_SCOPES.has(scope);
}

export function asScopeOf(from, made) {
  return ROOT_VERB_SCOPES.has(from) ? markRootVerbScope(made) : made;
}

// envMerge(env, otherMap) → a new scope, the names of the map over its own.
export function envMerge(env, otherMap) {
  const next = new Map(env);
  for (const [key, value] of otherMap) next.set(key, value);
  return asScopeOf(env, next);
}

// The state of the evaluator, the value in the pipe, the scope and the
// evaluation depth, a new state at each step, so a fork leaves the
// declarations of its inside behind by keeping the state it started from;
// the scope maps the names a reader declared to their records over the root
// the host's sources declared, under a key no name spells, a lookup reading
// the scope and then the root [QSDSP#residence], [QSNAM#verb].

import { CallEvaluationDepthExceededError } from './errors.mjs';
import { ROOT_KEY, QUERY_KEY } from './scope-keys.mjs';

// The deepest evaluation depth `nestState` admits: a runaway, a verb that
// calls itself without end, is refused one deeper, and the host's heap stays
// bounded [QSNAM#verb].
export const EVAL_DEPTH_LIMIT = 1000;

// The calls a state runs within keep the origin of each quote they
// received, the nearest first, a state a verb of the host reads keeps beside
// the tree of the query the scope of its own step, and the state of a call
// the flight of its failure, which no other keeps [QSQUO#held], [QSNAM#owner], [QSERR#trace].
function makeState(pipeValue, scope, depth, calls = null, own = null, flight = null) {
  return Object.freeze({ pipeValue, scope, depth, calls, own, flight });
}

// rootState(pipeValue, scope) → a state at depth 0, the first of a query, a
// cell of a session or a source of the root.
export function rootState(pipeValue, scope) {
  return makeState(pipeValue, scope, 0);
}

// withPipeValue(state, nextPipeValue) → a state at the same depth holding
// the value.
export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.scope, state.depth, state.calls);
}

// withScope(state, nextScope) → a state at the same depth holding the scope.
export function withScope(state, nextScope) {
  return makeState(state.pipeValue, nextScope, state.depth, state.calls);
}

// withFlight(state, flight) → the state of a call with the flight of its failure.
export function withFlight(state, flight) {
  return makeState(state.pipeValue, state.scope, state.depth, state.calls, state.own, flight);
}

// depthBelow(state) → the evaluation depth one deeper than a state, or
// CallEvaluationDepthExceededError once it passes EVAL_DEPTH_LIMIT, its
// fact `:depth` the depth refused; a read that runs with no state of its
// own meets the limit by it alone [QSNAM#verb].
export function depthBelow(state) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) throw new CallEvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  return depth;
}

// nestState(state, pipeValue, scope) → the state one deeper in the evaluation
// depth.
export function nestState(state, pipeValue, scope) {
  return makeState(pipeValue, scope, depthBelow(state), state.calls);
}

// withCall(state, origins) → the state of the run of a call, which keeps
// the origin of each quote the call received for the code run within it,
// before those of the calls around it [QSQUO#held].
export function withCall(state, origins) {
  return makeState(state.pipeValue, state.scope, state.depth, { origins, around: state.calls }, state.own);
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
  return state.own ?? state.scope;
}

const NO_ROOT = new Map();

// rootOf(scope) → the root beneath a scope, the bindings the host's
// sources declared.
export function rootOf(scope) {
  return scope.get(ROOT_KEY) ?? NO_ROOT;
}

// scopeHas(scope, name) → whether the scope or the root holds the name.
export function scopeHas(scope, name) {
  return scope.has(name) || rootOf(scope).has(name);
}

// queryTreeOf(scope) → the tree of names of the query a scope runs under:
// in the recipe of a verb, the tree of the query that called it, carried
// down through every verb the recipe calls, and elsewhere the scope itself.
// A verb of the host reads it at its call, while the names a recipe writes
// read the scope the recipe runs in, so a verb written in the language and
// a verb of the host read the same tree [QSNAM#owner].
export function queryTreeOf(scope) {
  return scope.get(QUERY_KEY) ?? scope;
}

// queryStateOf(state) → the state as a verb of the host reads it at its
// call: its value and its depth over the tree of the query [QSNAM#owner].
export function queryStateOf(state) {
  const tree = queryTreeOf(state.scope);
  return tree === state.scope ? state : makeState(state.pipeValue, tree, state.depth, state.calls, state.scope, state.flight);
}

// scopeSet(scope, name, value) → a new scope, the name holding the value; the
// recipe of a verb keeps its own names out of the tree of the query, as a
// verb of the host does [QSNAM#owner].
export function scopeSet(scope, name, value) {
  const made = new Map(scope).set(name, value);
  return isRootVerbScope(scope) ? markRootVerbScope(made) : made;
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

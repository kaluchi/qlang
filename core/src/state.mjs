// [QSDSP#residence], [QSNAM#verb]

import { CallEvaluationDepthExceededError } from './errors.mjs';
import { ROOT_KEY, QUERY_KEY } from './scope-keys.mjs';

// [QSNAM#verb]
export const EVAL_DEPTH_LIMIT = 1000;

// [QSQUO#held], [QSNAM#owner], [QSERR#trace]
function makeState(pipeValue, scope, depth, calls = null, own = null, flight = null) {
  return Object.freeze({ pipeValue, scope, depth, calls, own, flight });
}

export function rootState(pipeValue, scope) {
  return makeState(pipeValue, scope, 0);
}

export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.scope, state.depth, state.calls);
}

export function withScope(state, nextScope) {
  return makeState(state.pipeValue, nextScope, state.depth, state.calls);
}

export function withFlight(state, flight) {
  return makeState(state.pipeValue, state.scope, state.depth, state.calls, state.own, flight);
}

// [QSNAM#verb]
export function depthBelow(state) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) throw new CallEvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  return depth;
}

export function nestState(state, pipeValue, scope) {
  return makeState(pipeValue, scope, depthBelow(state), state.calls);
}

// [QSQUO#held]
export function withCall(state, origins) {
  return makeState(state.pipeValue, state.scope, state.depth, { origins, around: state.calls }, state.own);
}

export function originIn(state, quote) {
  for (let call = state.calls; call !== null; call = call.around) {
    const origin = call.origins.get(quote);
    if (origin !== undefined) return origin;
  }
  return undefined;
}

// [QSNAM#owner]
export function ownScopeOf(state) {
  return state.own ?? state.scope;
}

const NO_ROOT = new Map();

export function rootOf(scope) {
  return scope.get(ROOT_KEY) ?? NO_ROOT;
}

export function scopeHas(scope, name) {
  return scope.has(name) || rootOf(scope).has(name);
}

export function queryTreeOf(scope) {
  return scope.get(QUERY_KEY) ?? scope;
}

export function queryStateOf(state) {
  const tree = queryTreeOf(state.scope);
  return tree === state.scope ? state : makeState(state.pipeValue, tree, state.depth, state.calls, state.scope, state.flight);
}

export function scopeSet(scope, name, value) {
  const made = new Map(scope).set(name, value);
  return isRootVerbScope(scope) ? markRootVerbScope(made) : made;
}

const ROOT_VERB_SCOPES = new WeakSet();

export function markRootVerbScope(scope) {
  ROOT_VERB_SCOPES.add(scope);
  return scope;
}

export function isRootVerbScope(scope) {
  return ROOT_VERB_SCOPES.has(scope);
}

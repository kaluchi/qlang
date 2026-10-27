// [QSDSP#residence], [QSNAM#verb]

import { CallEvaluationDepthExceededError } from './errors.mjs';
import { ROOT_KEY, QUERY_KEY } from './scope-keys.mjs';

// [QSNAM#verb]
export const EVAL_DEPTH_LIMIT = 1000;

// [D468], [QSNAM#owner], [QSERR#trace]
function makeState(pipeValue, scope, depth, written = null, own = null, flight = null) {
  return Object.freeze({ pipeValue, scope, depth, written, own, flight });
}

export function rootState(pipeValue, scope) {
  return makeState(pipeValue, scope, 0);
}

export function withPipeValue(state, nextPipeValue) {
  return makeState(nextPipeValue, state.scope, state.depth, state.written);
}

export function withScope(state, nextScope) {
  return makeState(state.pipeValue, nextScope, state.depth, state.written);
}

export function withFlight(state, flight) {
  return makeState(state.pipeValue, state.scope, state.depth, state.written, state.own, flight);
}

// [QSNAM#verb]
export function depthBelow(state) {
  const depth = state.depth + 1;
  if (depth > EVAL_DEPTH_LIMIT) throw new CallEvaluationDepthExceededError({ depth, limit: EVAL_DEPTH_LIMIT });
  return depth;
}

export function nestState(state, pipeValue, scope) {
  return makeState(pipeValue, scope, depthBelow(state));
}

// [D468]
export function withWritten(state, written) {
  return makeState(state.pipeValue, state.scope, state.depth, written, state.own);
}

export const writtenIn = (state, quote) => state.written?.has(quote) === true;

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
  return tree === state.scope ? state : makeState(state.pipeValue, tree, state.depth, state.written, state.scope, state.flight);
}

export function scopeSet(scope, name, value) {
  return marksKept(scope, new Map(scope).set(name, value));
}

export function scopeWith(scope, entries) {
  const made = new Map(scope);
  for (const [name, value] of entries) made.set(name, value);
  return marksKept(scope, made);
}

function marksKept(scope, made) {
  if (isRootVerbScope(scope)) markRootVerbScope(made);
  if (growsItsTree(scope)) markTreeGrowing(made);
  return made;
}

// [D468]
const GROWING_TREES = new WeakSet();

export function markTreeGrowing(scope) {
  GROWING_TREES.add(scope);
  return scope;
}

export const growsItsTree = scope => GROWING_TREES.has(scope);

const ROOT_VERB_SCOPES = new WeakSet();

export function markRootVerbScope(scope) {
  ROOT_VERB_SCOPES.add(scope);
  return scope;
}

export function isRootVerbScope(scope) {
  return ROOT_VERB_SCOPES.has(scope);
}

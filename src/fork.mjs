// Fork semantics.
//
// On entry to a nested expression — `(...)`, `[...]`, `{...}`,
// `#{...}` — the inner sub-pipeline starts with a copy of the
// outer state. When the sub-pipeline finishes, its final
// pipeValue propagates out, but its env changes are discarded.
//
// "Copy" here is structural: the env Map is shared by reference
// (immutable from the user's perspective; envSet returns a new
// Map). What matters is that the OUTER state is preserved when
// the fork closes — we throw away the inner state object.

import { makeState, withPipeValue } from './state.mjs';

// fork(state, sub) → state'
//
// Runs `sub(innerState)` starting from a copy of `state`. Whatever
// pipeValue the sub returns becomes the new pipeValue of the outer
// state; the outer env is preserved.
//
// `sub` is a function (innerState) → finalInnerState.
export function fork(state, sub) {
  const innerStart = makeState(state.pipeValue, state.env);
  const innerEnd = sub(innerStart);
  return withPipeValue(state, innerEnd.pipeValue);
}

// forkWith(state, pipeValue, sub) → state'
//
// Same as fork() but seeds the inner pipeValue with a different
// value (used by `*` distribute, where each iteration's inner
// pipeValue is a Vec element rather than the outer Vec).
export function forkWith(state, pipeValue, sub) {
  const innerStart = makeState(pipeValue, state.env);
  const innerEnd = sub(innerStart);
  return withPipeValue(state, innerEnd.pipeValue);
}

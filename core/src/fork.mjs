// Fork semantics.
//
// On entry to a nested expression — `(...)`, `[...]`, `{...}`,
// `#[...]` — the inner sub-pipeline starts from the outer state.
// When the sub-pipeline finishes, its final pipeValue propagates
// out, but its env changes are discarded.
//
// States are frozen and every step forges a fresh one, so the
// outer State object survives the inner run untouched; the fork
// closes by lifting the inner pipeValue onto that outer State and
// dropping the inner State. A fork stays on the outer frame: the
// depth budget counts conduit bodies, captured-arg lambdas, and
// re-entry seams, while a nested literal or paren-group is bounded
// by the source text.

import { withPipeValue } from './state.mjs';

// fork(state, sub) → Promise<state'>
//
// Runs `sub(state)`. Whatever pipeValue the sub returns becomes the
// new pipeValue of the outer state; the outer env is preserved.
//
// `sub` is a function (innerState) → Promise<finalInnerState>.
export async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

// forkWith(state, forkPipeValue, sub) → Promise<state'>
//
// Same as fork() but seeds the inner pipeValue with the caller-
// supplied value (used by `*` distribute, where each iteration's
// inner pipeValue is a Vec element drawn from the outer Vec).
export async function forkWith(state, forkPipeValue, sub) {
  const innerEnd = await sub(withPipeValue(state, forkPipeValue));
  return withPipeValue(state, innerEnd.pipeValue);
}

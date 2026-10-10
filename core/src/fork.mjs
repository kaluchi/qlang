// The fork rule: a nested pipeline, a group or a word of a literal, starts
// from the outer state and hands back its value alone, its declarations
// left behind, on the outer frame of the depth budget.

import { withPipeValue } from './state.mjs';

// fork(state, sub) → the outer state with the value `sub(state)` answers.
export async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

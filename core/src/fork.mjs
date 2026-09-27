// The fork rule: a nested pipeline, a group or a word of a literal, starts
// from the outer state and hands back its value alone, its declarations
// left behind, on the outer frame of the depth budget.

import { withPipeValue } from './state.mjs';

// fork(state, sub) → the outer state with the value `sub(state)` answers.
export async function fork(state, sub) {
  const innerEnd = await sub(state);
  return withPipeValue(state, innerEnd.pipeValue);
}

async function forkWith(state, forkPipeValue, sub) {
  const innerEnd = await sub(withPipeValue(state, forkPipeValue));
  return withPipeValue(state, innerEnd.pipeValue);
}

// forkEach(state, forkPipeValues, sub) → the values the forks of a
// sequence answer, one seeded with each value, run one after another in
// its order [D84].
export async function forkEach(state, forkPipeValues, sub) {
  const answers = [];
  for (const forkPipeValue of forkPipeValues) answers.push((await forkWith(state, forkPipeValue, sub)).pipeValue);
  return answers;
}

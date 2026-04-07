// Introspection: env pseudo-operand.
//
// `env` is special — it reads the evaluator's state rather than
// applying a pure function to a subject. The `pseudo: true` option
// on makeFn signals to the evaluator that this operand wants the
// full state pair instead of going through Rule 10.

import { makeFn } from '../rule10.mjs';
import { withPipeValue } from '../state.mjs';

// env — replaces pipeValue with the current env Map. Inside a
// fork, returns the fork's current env (including any local `as`
// or `let` writes visible at this point).
export const env = makeFn('env', 0, (state) => withPipeValue(state, state.env), { pseudo: true });

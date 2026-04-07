// Introspection: env pseudo-operand.
//
// `env` is special — it reads the evaluator's state rather than
// applying a pure function to a subject. We model it as a function
// value with `pseudo: true`, which the evaluator detects and
// dispatches to a state-aware handler.

import { withPipeValue } from '../state.mjs';

export const env = Object.freeze({
  type: 'function',
  name: 'env',
  arity: 0,
  pseudo: true,
  fn: (state) => withPipeValue(state, state.env)
});

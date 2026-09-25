// `env` — the reflective operand that reads the env directly: it
// answers the bindings the scope holds as a Map, the names the query,
// the session and a module's `use` wrote [D61], each as the record of
// its binding [D63], so introspective queries (`env | keys`, `env | /x
// | /value`) compose through the regular Map operand surface.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withPipeValue } from '../state.mjs';
import { scopeBindingsOf } from './nouns.mjs';

// `env` — replaces `pipeValue` with the bindings of the scope.
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, scopeBindingsOf(state.env)));

bindPrim('env', env);

// `env` and `as` operands — the two reflective bindings that read
// or write the env directly.
//
// `env` exposes the current env Map as the new `pipeValue`, so
// introspective queries (`env | keys`, `env | /count | reify`)
// compose through the regular Map operand surface.
//
// `as(:name)` snapshots the current `pipeValue` under a keyword
// name and threads `pipeValue` through unchanged. The snapshot is
// reachable through identifier lookup (auto-unwrapped to the raw
// value) and through `reify(:name)` (with the wrapper preserved
// for metadata inspection including attached docs).

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { makeState, withPipeValue, envSet } from '../state.mjs';
import { isKeyword, typeKeyword, makeSnapshot } from '../types.mjs';
import { declareShapeError } from '../operand-errors.mjs';

const AsNameNotKeywordError = declareShapeError('AsNameNotKeywordError',
  ({ actualType }) => `as requires a keyword argument (the binding name), got ${actualType.name}`);

// `env` — replaces `pipeValue` with the current env Map.
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, state.env));

// `as(:name)` — snapshot the current `pipeValue` under a keyword
// name. Identity on `pipeValue`; writes the snapshot wrapper into
// `env[:name]`. Doc comments stashed on `asLambdas` (attached at
// parse time through DocAttachedSequence) ride into the snapshot
// alongside the captured value.
export const asOperand = stateOp('as', 2, async (state, asLambdas) => {
  const asNameValue = await asLambdas[0](state.pipeValue);
  if (!isKeyword(asNameValue)) {
    throw new AsNameNotKeywordError({ actualType: typeKeyword(asNameValue), actualValue: asNameValue });
  }
  const asBindingName = asNameValue.name;
  const asSnapshot = makeSnapshot(state.pipeValue, {
    name: asBindingName,
    docs: asLambdas.docs,
    location: asLambdas.location
  });
  const asNextEnv = envSet(state.env, asBindingName, asSnapshot);
  return makeState(state.pipeValue, asNextEnv);
});

bindPrim('env', env);
bindPrim('as',  asOperand);

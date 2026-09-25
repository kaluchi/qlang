// `env` and `as` operands — the two reflective bindings that read
// or write the env directly.
//
// `env` answers the bindings the scope holds as a Map, the names the
// query, the session and a module's `use` wrote [D61], each as the
// record of its binding [D63], so introspective queries
// (`env | keys`, `env | /x | /value`) compose through the regular Map
// operand surface.
//
// `as :name` writes the record of a binding holding the current
// `pipeValue` under a keyword name and threads `pipeValue` through
// unchanged. Identifier lookup reads the value the record holds; the
// attached doc-prefix surfaces through `:name | docs`.

import { stateOp } from './dispatch.mjs';
import { bindPrim } from '../primitives.mjs';
import { withEnv, withPipeValue, envSet } from '../state.mjs';
import { isKeyword, keyword, typeKeyword, makeBinding } from '../types.mjs';
import { declareShapeError } from '../errors.mjs';
import { quoteOfBody } from '../quote.mjs';
import { moduleUriOf } from '../walk.mjs';
import { scopeBindingsOf } from './nouns.mjs';

const AsNameNotKeywordError = declareShapeError('AsNameNotKeywordError',
  ({ actualType }) => `as requires a keyword argument (the binding name), got ${actualType.name}`,
  { operand: 'as', expectedType: 'keyword' }
);

// `env` — replaces `pipeValue` with the bindings of the scope.
export const env = stateOp('env', 1, (state, _lambdas) =>
  withPipeValue(state, scopeBindingsOf(state.env)));

// `as :name` — the record of a binding holding the current
// `pipeValue`, written into `env[:name]` with the doc comments and the
// step the call carries on `asLambdas` [D63]. Identity on `pipeValue`.
export const asOperand = stateOp('as', 2, async (state, asLambdas) => {
  const asNameValue = await asLambdas[0](state.pipeValue);
  if (!isKeyword(asNameValue)) {
    throw new AsNameNotKeywordError({ actualType: typeKeyword(asNameValue), actualValue: asNameValue });
  }
  const asRecord = makeBinding({
    name: asNameValue,
    docs: asLambdas.docs,
    value: state.pipeValue,
    source: quoteOfBody(asLambdas.step),
    module: keyword(moduleUriOf(asLambdas.step))
  });
  return withEnv(state, envSet(state.env, asNameValue.name, asRecord));
});

bindPrim('env', env);
bindPrim('as',  asOperand);

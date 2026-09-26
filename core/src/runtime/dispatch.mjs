// The wrapper of the loader's `use`, the one operand of the core that
// steps over the state pair itself [D79], and the minting of a value
// under a tag, which the verbs that keep a kind and `tag` share.
//
// Every function value installed in langRuntime has the uniform
// signature `(state, lambdas) → state`; `stateOpVariadic` builds one over
// a range of captured-arg counts, the `captured` range the descriptor of
// `use` records.

import { makeFn } from '../rule10.mjs';
import { envGet } from '../state.mjs';
import { declareInvariantError } from '../errors.mjs';
import { isQMap, isErrorValue, makeTaggedInstance, bindingValueOf } from '../types.mjs';
import { tagBindingKey } from '../env-keys.mjs';

// `mintTaggedInstance` lives in `eval.mjs`, which depends on
// `runtime/index.mjs`, which depends on `runtime/use-op.mjs`, which
// builds `use` from this file at its top level — a static import here
// would close a cycle and trip TDZ whenever a consumer enters the graph
// through `runtime/dispatch.mjs` first. The dynamic form below resolves
// `eval.mjs` after every module in the cycle finishes initialising;
// Node caches the resolution after the first call.

// ── Per-site invariant errors for variadic registration ───────

const StateOpVariadicMissingCapturedError = declareInvariantError(
  'StateOpVariadicMissingCapturedError',
  ({ operandName }) => `stateOpVariadic('${operandName}') requires captured range`,
  { operand: '::qlang' }
);

// Whether a tag's binding carries a constructor, the `:impl` that
// re-establishes the tag's invariant on a payload.
function tagCarriesConstructor(state, tagName) {
  const resolved = bindingValueOf(envGet(state.env, tagBindingKey(tagName)));
  return isQMap(resolved) && resolved.has('impl');
}

// mintUnderTag(state, tag, value) — the value under the tag: through
// the tag's constructor when it carries one, as a bare overlay when
// the tag names an identity alone. A tag laid over an error answers
// the error, since no tag stands over one [D86].
export async function mintUnderTag(state, tag, value) {
  if (isErrorValue(value)) return value;
  if (!tagCarriesConstructor(state, tag.name)) return makeTaggedInstance(tag, value);
  const { mintTaggedInstance } = await import('../eval.mjs');
  return await mintTaggedInstance(tag.name, value, state);
}

export function stateOpVariadic(name, impl, captured) {
  if (!captured) {
    throw new StateOpVariadicMissingCapturedError({ operandName: name });
  }
  return makeFn(name, captured[1], async (state, variadicLambdas) => {
    return await impl(state, variadicLambdas);
  }, { captured });
}

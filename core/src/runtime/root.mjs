// The root [D153]: the scope a host's sources declare before the reader's
// first step, each source a cell run over the root the sources before it
// left, the language's first. A name the root holds is declared once, so
// a source that declares one again is refused; each verb a source
// declares is the host's, which alone reaches a primitive [D73], with the
// implementation the host handed beside the source [D80]; a refusal the
// source declares takes its address, the name it is declared by [D64].

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isErrorValue, isVerb, bindingValueOf, declareHostVerb, keyword } from '../types.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import {
  BindNameDeclaredTwiceError, declareInvariantError, declareShapeError, recordRefusalAddress, throwSiteSpecOf
} from '../errors.mjs';
import { splitAddress } from './nouns.mjs';

// A source of the root whose run answers an error left its later
// declarations undeclared; one the parser refuses raises the parse error
// with its uri.
export const RootSourceNotDeclaredError = declareInvariantError('RootSourceNotDeclaredError',
  ({ uri, tagName }) => `qlang root: the source ${uri} answered ${tagName}, and the declarations after it stay undeclared`,
  { operand: '::builtin' });

// An implementation a host hands for a name its source declares as no
// verb has nothing to run under.
export const RootImplNamesNoVerbError = declareShapeError('RootImplNamesNoVerbError',
  ({ uri, implName }) => `qlang root: the source ${uri} hands an implementation for ${implName.literal}, which it declares as no verb`,
  { operand: '::builtin' });

// The bindings a source declared, by name: those whose record names the
// source as its origin.
function declaredBy(env, uri) {
  const declared = new Map();
  for (const [name, record] of env) {
    if (isBinding(record) && record.get('origin')?.name === uri) declared.set(name, record);
  }
  return declared;
}

// declareRoot(env, sources) → the env whose root holds what each source
// declared, `{ uri, source, impls? }` in order, over the root `env` holds.
export async function declareRoot(env, sources) {
  let rootEnv = env;
  for (const { uri, source, impls = {} } of sources) {
    const answered = await evalAst(parse(source, { uri }), rootState(null, rootEnv));
    if (isErrorValue(answered.pipeValue)) {
      throw new RootSourceNotDeclaredError({ uri, tagName: answered.pipeValue.tag.literal });
    }
    const declared = declaredBy(answered.env, uri);
    for (const name of declared.keys()) {
      if (rootEnv.has(name)) throw new BindNameDeclaredTwiceError({ name });
    }
    for (const [name, record] of declared) {
      const value = bindingValueOf(record);
      if (isVerb(value)) declareHostVerb(value, impls[name] ?? null);
      const [, lastName] = splitAddress(name);
      if (throwSiteSpecOf(lastName) !== undefined) recordRefusalAddress(lastName, name);
    }
    for (const implName of Object.keys(impls)) {
      if (!isVerb(bindingValueOf(declared.get(implName)))) throw new RootImplNamesNoVerbError({ uri, implName: keyword(implName) });
    }
    const root = new Map(answered.env);
    root.delete(ROOT_KEY);
    rootEnv = new Map(root).set(ROOT_KEY, root);
  }
  return rootEnv;
}

// The root [D153]: the scope a host's sources declare before the reader's
// first step, each source a cell run in a frame over the root the sources
// before it left, the language's first. A name the root holds is declared
// once, so a source that declares one again answers the refusal of a
// second declaration and is refused; each verb a source declares is the
// host's, which alone reaches a primitive [D73], with the implementation
// the host handed beside the source [D80]; a refusal the source declares
// takes its address, the name it is declared by, once [D64].

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isErrorValue, isVerb, bindingValueOf, declareHostVerb, keyword } from '../types.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import {
  declareInvariantError, declareShapeError, recordRefusalAddress, refusalAddressOf, throwSiteSpecOf
} from '../errors.mjs';
import { rootOf, splitAddress } from './nouns.mjs';

// A source of the root whose run answers an error, a second declaration
// of a name the root holds among them, left its declarations out of the
// root; one the parser refuses raises the parse error with its uri.
export const RootSourceNotDeclaredError = declareInvariantError('RootSourceNotDeclaredError',
  ({ uri, tagName }) => `qlang root: the source ${uri} answered ${tagName}, and its declarations stay out of the root`,
  { operand: '::builtin' });

// An implementation a host hands for a name its source declares as no
// verb has nothing to run under.
export const RootImplNamesNoVerbError = declareShapeError('RootImplNamesNoVerbError',
  ({ uri, implName }) => `qlang root: the source ${uri} hands an implementation for ${implName.literal}, which it declares as no verb`,
  { operand: '::builtin' });

const DECLARED_TWICE = '::bind/BindNameDeclaredTwiceError';

// Whether a source declares again a name the root holds, or a refusal the
// root declared under another address: a refusal is declared once, so no
// source moves the address its tag answers by.
function declaresAgain(root, name) {
  if (root.has(name)) return true;
  const [, lastName] = splitAddress(name);
  if (throwSiteSpecOf(lastName) === undefined) return false;
  const recorded = refusalAddressOf(lastName);
  return recorded !== lastName && recorded !== name;
}

// declareRoot(env, sources) → the env whose root holds what each source
// declared, `{ uri, source, impls? }` in order, over the root `env` holds.
export async function declareRoot(env, sources) {
  let root = rootOf(env);
  for (const { uri, source, impls = {} } of sources) {
    const frame = new Map([[ROOT_KEY, root]]);
    const answered = await evalAst(parse(source, { uri }), rootState(null, frame));
    if (isErrorValue(answered.pipeValue)) {
      throw new RootSourceNotDeclaredError({ uri, tagName: answered.pipeValue.tag.literal });
    }
    const declared = new Map([...answered.env].filter(([, record]) => isBinding(record)));
    for (const name of declared.keys()) {
      if (declaresAgain(root, name)) throw new RootSourceNotDeclaredError({ uri, tagName: DECLARED_TWICE });
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
    root = new Map([...root, ...declared]);
  }
  return new Map(env).set(ROOT_KEY, root);
}

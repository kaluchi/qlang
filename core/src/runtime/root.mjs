// The root [D153]: the scope a host's sources declare before the reader's
// first step, each source a cell run in a frame over the root the sources
// before it left, the language's first. A source whose run answers an
// error, or that declares again a name the root holds, is refused; each
// verb and kind a source declares is the
// host's, which alone reaches a primitive [D73]: a verb whose step is
// `::builtin{}` the implementation the host handed beside the source
// under its name [D80], one whose step names a primitive of the core
// that primitive, each refused as the root is declared when it lacks
// one; a refusal the source declares takes its address, the name it is
// declared by, once [D64].

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isErrorValue, isSpec, isVerb, bindingValueOf, declareHostValue, keyword } from '../types.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import { rootOf } from '../state.mjs';
import {
  declareInvariantError, declareShapeError, recordRefusalAddress, refusalAddressOf, throwSiteSpecOf
} from '../errors.mjs';
import { splitAddress } from './nouns.mjs';
import { builtinOfVerb } from './verb.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

// A source of the root whose run answers an error, or that declares again
// a name the root holds, left its declarations out of the root, `:tagName`
// the refusal and `:name` the name declared again; one the parser refuses
// raises the parse error with its uri.
export const RootSourceNotDeclaredError = declareInvariantError('RootSourceNotDeclaredError',
  ({ uri, tagName, name }) => `qlang root: the source ${uri} is refused with ${tagName}${name === undefined ? '' : ` for ${name.literal}`}, and its declarations stay out of the root`,
  { operand: '::builtin' });

// An implementation a host hands for a name its source declares as no
// verb ending in `::builtin{}` has nothing to run under.
export const RootImplNamesNoVerbError = declareShapeError('RootImplNamesNoVerbError',
  ({ uri, implName }) => `qlang root: the source ${uri} hands an implementation for ${implName.literal}, which it declares as no verb ending in ::builtin{}`,
  { operand: '::builtin' });

const DECLARED_TWICE = '::bind/BindNameDeclaredTwiceError';

// Whether a source declares again a name the root holds, or a refusal the
// root declared under another address: the tag a refusal answers by is
// found by its last name until its site names its address [D46], so no
// source moves it.
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
    const again = [...declared.keys()].find(name => declaresAgain(root, name));
    if (again !== undefined) throw new RootSourceNotDeclaredError({ uri, tagName: DECLARED_TWICE, name: keyword(again) });
    for (const [name, record] of declared) {
      const value = bindingValueOf(record);
      const builtin = builtinOfVerb(value);
      if (builtin !== null && impls[name] === undefined) PRIMITIVE_REGISTRY.resolve(builtin.primitiveKey ?? name);
      if (isVerb(value) || isSpec(value)) declareHostValue(value, impls[name] ?? null);
      const [, lastName] = splitAddress(name);
      if (throwSiteSpecOf(lastName) !== undefined) recordRefusalAddress(lastName, name);
    }
    for (const implName of Object.keys(impls)) {
      if (builtinOfVerb(bindingValueOf(declared.get(implName)))?.primitiveKey !== null) {
        throw new RootImplNamesNoVerbError({ uri, implName: keyword(implName) });
      }
    }
    root = new Map([...root, ...declared]);
  }
  return new Map(env).set(ROOT_KEY, root);
}

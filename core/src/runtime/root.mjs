// The root [D153]: the scope a host's sources declare before the reader's
// first step, each source a cell run in a frame over the root the sources
// before it left, the language's first. A source whose run answers an
// error, or that declares again a name the root holds, is refused; each
// name under a label a source declares is the host's, which alone
// reaches an implementation [D34]: a name whose value is `::builtin{}`,
// or a function or a kind whose recipe is, runs the implementation the
// host handed beside the source under its name [D80], [D157], [D167], [D252],
// and is refused as the root is declared when it was handed none; a
// refusal the source declares takes its address, the name it is declared
// by, once [D64].

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isBuiltinDescriptor, isErrorValue, isFn, recipeOf, bindingValueOf, declareHostValue, keyword } from '../types.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import { rootOf } from '../state.mjs';
import { declareInvariantError } from '../errors.mjs';
import { isUnderLabel } from './nouns.mjs';

// A source of the root whose run answers an error, or that declares again
// a name the root holds, left its declarations out of the root, `:tagName`
// the refusal and `:name` the name declared again; one the parser refuses
// raises the parse error with its uri.
export const BuiltinRootSourceNotDeclaredError = declareInvariantError('builtin/RootSourceNotDeclaredError',
  ({ uri, tagName, name }) => `qlang root: the source ${uri} is refused with ${tagName}${name === undefined ? '' : ` for ${name.literal}`}, and its declarations stay out of the root`);

// A name a source of the root declares as `::builtin{}` that its host
// handed no implementation for has nothing to run [D157].
export const BuiltinImplementationNotHandedError = declareInvariantError('builtin/ImplementationNotHandedError',
  ({ name }) => `qlang root: no implementation is handed for ${name}, which its source declares as ::builtin{}`);

// An implementation a host hands for a name its source declares as no
// `::builtin{}` under a label has nothing to run under: a name written
// in steps runs them, and a bare name reads its value [D34], [D167].
export const BuiltinImplementationNamesNoBuiltinError = declareInvariantError('builtin/ImplementationNamesNoBuiltinError',
  ({ uri, name }) => `qlang root: the source ${uri} is handed an implementation for ${name.literal}, which it declares as no ::builtin{} under a label`);

const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';


// declareRoot(env, sources) → the env whose root holds what each source
// declared, `{ uri, source, impls? }` in order, over the root `env` holds.
export async function declareRoot(env, sources) {
  let root = rootOf(env);
  for (const { uri, source, impls = {} } of sources) {
    const frame = new Map([[ROOT_KEY, root]]);
    const answered = await evalAst(parse(source, { uri }), rootState(null, frame));
    if (isErrorValue(answered.pipeValue)) {
      throw new BuiltinRootSourceNotDeclaredError({ uri, tagName: answered.pipeValue.tag.literal });
    }
    const declared = new Map([...answered.env].filter(([, record]) => isBinding(record)));
    const again = [...declared.keys()].find(name => root.has(name));
    if (again !== undefined) throw new BuiltinRootSourceNotDeclaredError({ uri, tagName: DECLARED_TWICE, name: keyword(again) });
    for (const [name, record] of declared) {
      const builtin = builtinOf(bindingValueOf(record));
      if (builtin === null) continue;
      if (impls[name] === undefined) throw new BuiltinImplementationNotHandedError({ name });
      declareHostValue(builtin, impls[name]);
    }
    for (const implName of Object.keys(impls)) {
      if (builtinOf(bindingValueOf(declared.get(implName))) === null || !isUnderLabel(answered.env, implName)) {
        throw new BuiltinImplementationNamesNoBuiltinError({ uri, name: keyword(implName) });
      }
    }
    root = new Map([...root, ...declared]);
  }
  return new Map(env).set(ROOT_KEY, root);
}

// The descriptor of a host's primitive a name holds, itself or as the
// recipe of a function [D251], or null; the recipe of a kind is held by
// the node of its constructor [D252].
function builtinOf(value) {
  const recipe = isFn(value) ? recipeOf(value) : value;
  return isBuiltinDescriptor(recipe) ? recipe : null;
}

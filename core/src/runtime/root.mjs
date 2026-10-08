// The root [D153]: the scope a host's sources declare before the reader's
// first step, each source a cell run in a frame over the root the sources
// before it left, the language's first. A source whose run answers an
// error, or that declares again a name the root holds, is refused; each
// verb and kind a source declares is the
// host's, which alone reaches an implementation [D73]: a verb or a kind
// whose step is `::builtin{}` runs the implementation the host handed
// beside the source under its name [D80], [D157], and is refused as the
// root is declared when it was handed none; a refusal the source declares
// takes its address, the name it is declared by, once [D64].

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isErrorValue, isSpec, isVerb, bindingValueOf, declareHostValue, keyword } from '../types.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import { rootOf } from '../state.mjs';
import {
  declareInvariantError, declareShapeError
} from '../errors.mjs';
import { endsInBuiltin } from './verb.mjs';
import { ImplementationNotHandedError } from '../primitives.mjs';

// A source of the root whose run answers an error, or that declares again
// a name the root holds, left its declarations out of the root, `:tagName`
// the refusal and `:name` the name declared again; one the parser refuses
// raises the parse error with its uri.
export const RootSourceNotDeclaredError = declareInvariantError('builtin/RootSourceNotDeclaredError',
  ({ uri, tagName, name }) => `qlang root: the source ${uri} is refused with ${tagName}${name === undefined ? '' : ` for ${name.literal}`}, and its declarations stay out of the root`,
  { operand: '::builtin' });

// An implementation a host hands for a name its source declares as no
// verb or kind ending in `::builtin{}` has nothing to run under.
export const ImplementationNamesNoBuiltinError = declareShapeError('builtin/ImplementationNamesNoBuiltinError',
  ({ uri, name }) => `qlang root: the source ${uri} hands an implementation for ${name.literal}, which it declares as no verb or kind ending in ::builtin{}`,
  { operand: '::builtin' });

const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';


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
    const again = [...declared.keys()].find(name => root.has(name));
    if (again !== undefined) throw new RootSourceNotDeclaredError({ uri, tagName: DECLARED_TWICE, name: keyword(again) });
    for (const [name, record] of declared) {
      const value = bindingValueOf(record);
      if (endsInBuiltin(value) && impls[name] === undefined) throw new ImplementationNotHandedError({ name });
      if (isVerb(value) || isSpec(value)) declareHostValue(value, impls[name]);
    }
    for (const implName of Object.keys(impls)) {
      if (!endsInBuiltin(bindingValueOf(declared.get(implName)))) {
        throw new ImplementationNamesNoBuiltinError({ uri, name: keyword(implName) });
      }
    }
    root = new Map([...root, ...declared]);
  }
  return new Map(env).set(ROOT_KEY, root);
}

// The root [D153]: the scope a host's sources declare before the reader's
// first step, each source a cell run in a frame over the root the sources
// before it left, the language's first. A source whose run answers an
// error, or that declares again a name the root holds, is refused; each
// name under a label a source declares is the host's, which alone
// reaches an implementation [D34]: a name that is `::builtin{}`, the
// `construct` of a kind among them, runs the implementation the host
// handed beside the source under its name [D80], [D157], [D167], [D169],
// and is refused as the root is declared when it was handed none; a
// refusal the source declares takes its address, the name it is declared
// by, once [D64].

import { parse } from '../parse.mjs';
import { evalAst } from '../eval.mjs';
import { rootState, markRootWordScope } from '../state.mjs';
import { isBinding, isBuiltinDescriptor, isErrorValue, isQuote, bindingValueOf, declareHostValue, keyword, quoteEnvRef } from '../types.mjs';
import { splitAddress } from '../address.mjs';
import { ROOT_KEY } from '../env-keys.mjs';
import { rootOf } from '../state.mjs';
import { declareInvariantError } from '../errors.mjs';
import { holdsAPage, isUnderLabel } from './nouns.mjs';

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
      const value = bindingValueOf(record);
      if (!isBuiltinDescriptor(value)) continue;
      if (impls[name] === undefined) throw new BuiltinImplementationNotHandedError({ name });
      declareHostValue(value, impls[name]);
    }
    for (const implName of Object.keys(impls)) {
      if (!isBuiltinDescriptor(bindingValueOf(declared.get(implName))) || !isUnderLabel(answered.env, implName)) {
        throw new BuiltinImplementationNamesNoBuiltinError({ uri, name: keyword(implName) });
      }
    }
    root = new Map([...root, ...declared]);
    runInTheRoot(declared, root);
  }
  return new Map(env).set(ROOT_KEY, root);
}

// A quote a source declared runs in a frame of the source's bare values,
// its names of one segment that hold no page, over the root the source
// joined, so its words read those values first, and a label is no bare
// name [D191], [D200].
function runInTheRoot(declared, root) {
  const frame = markRootWordScope(new Map([[ROOT_KEY, root]]));
  for (const [name, record] of declared) {
    if (splitAddress(name)[0] === null && !holdsAPage(record)) frame.set(name, record);
  }
  for (const record of declared.values()) {
    const value = bindingValueOf(record);
    if (isQuote(value) && quoteEnvRef(value) !== undefined) quoteEnvRef(value).env = frame;
  }
}

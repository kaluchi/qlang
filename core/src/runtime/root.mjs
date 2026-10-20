// The root [QSHST#source]: the scope a host's sources declare before the reader's
// first step, each source a cell run in a scope over the root the sources
// before it left, the language's first. A source whose run answers an error,
// or that declares again a name the root holds, is refused; each name under a
// label a source declares is the host's, which alone reaches a primitive
// [QSDSP#walk]: a name whose value is `::builtin{}`, or a function whose
// recipe is or a kind whose constructor is, runs the primitive the host handed
// beside the source under its name, the answer of one the table of the core
// does not hold held at the door [QSDSP#residence], [QSQUO#modifier], and is
// refused as the root is declared when it was handed none; a refusal the
// source declares takes its address, the name it is declared by, once [QSERR#site].

import { parse } from '../parse.mjs';
import { evalPipeline } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isBuiltinDescriptor, isErrorValue, isFn, isPrimitiveHanded, recipeOf, bindingValueOf, takePrimitive, keyword } from '../types.mjs';
import { ROOT_KEY } from '../scope-keys.mjs';
import { rootOf } from '../state.mjs';
import { declareDefect } from '../errors.mjs';
import { isUnderLabel } from '../nouns.mjs';
import { splitAddress } from '../address.mjs';
import { CONSTRUCT_NAME, functionOfRecipe } from '../chain.mjs';

// A source of the root whose run answers an error, or that declares again
// a name the root holds, left its declarations out of the root, `:origin`
// the source, `:tagName` the refusal and `:name` the name declared again;
// one the parser refuses raises the parse error with its uri.
export const BuiltinRootSourceNotDeclaredError = declareDefect('builtin/RootSourceNotDeclaredError',
  ({ origin, tagName, name }) => `qlang root: the source ${origin.name} is refused with ${tagName}${name === undefined ? '' : ` for ${name.literal}`}, and its declarations stay out of the root`);

// A name a source of the root declares as `::builtin{}` that its host
// handed no primitive for has nothing to run [QSDSP#residence].
export const BuiltinPrimitiveNotHandedError = declareDefect('builtin/PrimitiveNotHandedError',
  ({ origin, name }) => `qlang root: no primitive is handed for ${name.literal}, which the source ${origin.name} declares as ::builtin{}`);

// A primitive a host hands for a name its source declares as no `::builtin{}`
// under a label has nothing to run under: a name written in steps runs them, a
// bare name reads its value, and one that holds the `::builtin{}` another name
// took, `:sharedWith`, takes no primitive of its own [QSDSP#walk], [QSQUO#modifier], [QSHST#source].
export const BuiltinPrimitiveNamesNoBuiltinError = declareDefect('builtin/PrimitiveNamesNoBuiltinError',
  ({ origin, name, sharedWith }) => `qlang root: the source ${origin.name} is handed a primitive for ${name.literal}, ${sharedWith === undefined
    ? 'which it declares as no ::builtin{} under a label' : `whose ::builtin{} is another name's, ${sharedWith.literal}, which took it first`}`);

const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';


// declareRoot(scope, sources) → the scope whose root holds what each source
// declared, `{ uri, source, primitives? }` in order, over the root `scope`
// holds: each `::builtin{}` takes the primitive of the first name that holds
// it, and a name that holds one another name took takes none [QSHST#source].
export async function declareRoot(scope, sources) {
  let root = rootOf(scope);
  for (const { uri, source, primitives = {} } of sources) {
    const origin = keyword(uri);
    const sourceScope = new Map([[ROOT_KEY, root]]);
    const answered = await evalPipeline(parse(source, { uri }), rootState(null, sourceScope));
    if (isErrorValue(answered.pipeValue)) {
      throw new BuiltinRootSourceNotDeclaredError({ origin, tagName: answered.pipeValue.tag.literal });
    }
    const declared = new Map([...answered.scope].filter(([, record]) => isBinding(record)));
    const again = [...declared.keys()].find(name => root.has(name));
    if (again !== undefined) throw new BuiltinRootSourceNotDeclaredError({ origin, tagName: DECLARED_TWICE, name: keyword(again) });
    const taking = new Set();
    for (const [name, record] of declared) {
      const value = bindingValueOf(record);
      const builtin = builtinOf(value);
      if (builtin === null || isPrimitiveHanded(builtin)) continue;
      const primitive = primitives[name];
      if (primitive === undefined) throw new BuiltinPrimitiveNotHandedError({ origin, name: keyword(name) });
      takePrimitive(builtin, primitive, holdersOf(name, value, declared), splitAddress(name)[0]);
      taking.add(name);
    }
    for (const primitiveName of Object.keys(primitives)) {
      if (taking.has(primitiveName) && isUnderLabel(answered.scope, primitiveName)) continue;
      const held = builtinOf(bindingValueOf(declared.get(primitiveName)));
      const facts = { origin, name: keyword(primitiveName) };
      if (held !== null && !taking.has(primitiveName)) facts.sharedWith = keyword([...root, ...declared].find(([, record]) => builtinOf(bindingValueOf(record)) === held)[0]);
      throw new BuiltinPrimitiveNamesNoBuiltinError(facts);
    }
    root = new Map([...root, ...declared]);
  }
  return new Map(scope).set(ROOT_KEY, root);
}

// The descriptor of a host's primitive a name holds, itself or as the
// recipe of a function, or null; the constructor a host hands a kind is
// held by its own node, `construct` [QSHST#source].
function builtinOf(value) {
  const recipe = isFn(value) ? recipeOf(value) : value;
  return isBuiltinDescriptor(recipe) ? recipe : null;
}

// The functions or the kind a primitive is handed with, which alone run it,
// the kind beside the node `construct` that holds its constructor [QSHST#source].
function holdersOf(name, value, declared) {
  if (isFn(value)) return [value];
  const [labelName, lastName] = splitAddress(name);
  return lastName === CONSTRUCT_NAME ? [functionOfRecipe(value), bindingValueOf(declared.get(labelName))] : [functionOfRecipe(value)];
}


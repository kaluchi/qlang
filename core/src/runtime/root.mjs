// [QSHST#source], [QSDSP#walk], [QSDSP#residence], [QSQUO#modifier], [QSERR#site]

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

export const BuiltinRootSourceNotDeclaredError = declareDefect('builtin/RootSourceNotDeclaredError',
  ({ origin, tagName, name }) => `qlang root: the source ${origin.name} is refused with ${tagName}${name === undefined ? '' : ` for ${name.literal}`}, and its declarations stay out of the root`);

// [QSDSP#residence]
export const BuiltinPrimitiveNotHandedError = declareDefect('builtin/PrimitiveNotHandedError',
  ({ origin, name }) => `qlang root: no primitive is handed for ${name.literal}, which the source ${origin.name} declares as ::builtin{}`);

// [QSDSP#walk], [QSQUO#modifier], [QSHST#source]
export const BuiltinPrimitiveNamesNoBuiltinError = declareDefect('builtin/PrimitiveNamesNoBuiltinError',
  ({ origin, name, sharedWith }) => `qlang root: the source ${origin.name} is handed a primitive for ${name.literal}, ${sharedWith === undefined
    ? 'which it declares as no ::builtin{} under a label' : `whose ::builtin{} is another name's, ${sharedWith.literal}, which took it first`}`);

const DECLARED_TWICE = '::bind/NameDeclaredTwiceError';


// [QSHST#source]
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

function builtinOf(value) {
  const recipe = isFn(value) ? recipeOf(value) : value;
  return isBuiltinDescriptor(recipe) ? recipe : null;
}

function holdersOf(name, value, declared) {
  if (isFn(value)) return [value];
  const [labelName, lastName] = splitAddress(name);
  return lastName === CONSTRUCT_NAME ? [functionOfRecipe(value), bindingValueOf(declared.get(labelName))] : [functionOfRecipe(value)];
}


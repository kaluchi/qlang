// [QSHST#source], [QSDSP#walk], [QSDSP#residence], [QSQUO#modifier], [QSERR#site]

import { parseSource } from '../parse.mjs';
import { evalPipeline } from '../eval.mjs';
import { rootState } from '../state.mjs';
import { isBinding, isDoc, isErrorValue, isFn, isKind, isPrimitiveHanded, bindingValueOf, builtinOf, takePrimitive, takeWiring, makeBinding, makeKeyword, makeTag } from '../types.mjs';
import { ROOT_KEY } from '../scope-keys.mjs';
import { rootOf } from '../state.mjs';
import { declareDefect } from '../errors.mjs';
import { declaresALabel, isLabel, isUnderLabel } from '../nouns.mjs';
import { splitAddress } from '../address.mjs';
import { functionOfRecipe, wiringByPaths } from '../chain.mjs';

export const BuiltinRootSourceNotDeclaredError = declareDefect('builtin/RootSourceNotDeclaredError',
  ({ origin, refusal, name }) => `qlang root: the source ${origin.name} is refused with ${refusal.literal}${name === undefined ? '' : ` for ${name.literal}`}, and its declarations stay out of the root`);

// [QSHST#source]
export const BuiltinRootValueNotWordError = declareDefect('builtin/RootValueNotWordError',
  ({ origin, name }) => `qlang root: the source ${origin.name} declares ${name.literal}, a value under a bare name, which serves the query of its own text and reaches no reader: a source of the root declares words, a kind, a verb under a label and a node under a noun`);

// [QSDSP#residence]
export const BuiltinPrimitiveNotHandedError = declareDefect('builtin/PrimitiveNotHandedError',
  ({ origin, name }) => `qlang root: no primitive is handed for ${name.literal}, which the source ${origin.name} declares as ::builtin{}`);

// [QSDSP#walk], [QSQUO#modifier], [QSHST#source]
export const BuiltinPrimitiveNamesNoBuiltinError = declareDefect('builtin/PrimitiveNamesNoBuiltinError',
  ({ origin, name, sharedWith }) => `qlang root: the source ${origin.name} is handed a primitive for ${name.literal}, ${sharedWith === undefined
    ? 'which it declares as no ::builtin{} under a label' : `whose ::builtin{} is another name's, ${sharedWith.literal}, which took it first`}`);

const DECLARED_TWICE = makeTag('bind/NameDeclaredTwiceError');

// [QSHST#source], [QSSLF#page]
const HOST_NAME = 'host';
const HOST_ORIGIN = 'qlang/host';

function withThePageOfTheHost(root, declared) {
  const page = declared.get(HOST_NAME);
  const held = root.get(HOST_NAME);
  if (page === undefined || held === undefined || held.get('origin').name !== HOST_ORIGIN || !isDoc(bindingValueOf(page))) return root;
  declared.delete(HOST_NAME);
  return new Map(root).set(HOST_NAME, makeBinding({ name: held.get('name'), docs: page.get('docs'), value: bindingValueOf(held), source: page.get('source'), origin: page.get('origin') }));
}


// [QSHST#source], [QSNAM#root]
export async function declareRoot(scope, sources) {
  let root = rootOf(scope);
  for (const { uri, source, primitives = {} } of sources) {
    const origin = makeKeyword(uri);
    const sourceScope = new Map([[ROOT_KEY, root]]);
    const answered = await evalPipeline(parseSource(source, { uri }), rootState(null, sourceScope));
    if (isErrorValue(answered.pipeValue)) {
      throw new BuiltinRootSourceNotDeclaredError({ origin, refusal: answered.pipeValue.tag });
    }
    const declared = new Map([...answered.scope].filter(([, record]) => isBinding(record)));
    const value = [...declared].find(([name, record]) => splitAddress(name)[0] === null && !declaresALabel(record));
    if (value !== undefined) throw new BuiltinRootValueNotWordError({ origin, name: makeKeyword(value[0]) });
    root = withThePageOfTheHost(root, declared);
    const again = [...declared.keys()].find(name => root.has(name));
    if (again !== undefined) throw new BuiltinRootSourceNotDeclaredError({ origin, refusal: DECLARED_TWICE, name: makeKeyword(again) });
    const taking = new Set();
    for (const [name, record] of declared) {
      const value = bindingValueOf(record);
      const wiring = isKind(value) ? wiringByPaths(value) : null;
      if (wiring !== null) takeWiring(name, wiring);
      const builtin = builtinOf(value);
      if (builtin === null || isPrimitiveHanded(builtin)) continue;
      const primitive = primitives[name];
      if (primitive === undefined) throw new BuiltinPrimitiveNotHandedError({ origin, name: makeKeyword(name) });
      takePrimitive(builtin, primitive, [isFn(value) || isKind(value) ? value : functionOfRecipe(value)], name);
      taking.add(name);
    }
    for (const primitiveName of Object.keys(primitives)) {
      if (taking.has(primitiveName) && (isUnderLabel(answered.scope, primitiveName) || isLabel(answered.scope, primitiveName))) continue;
      const held = builtinOf(bindingValueOf(declared.get(primitiveName)));
      const facts = { origin, name: makeKeyword(primitiveName) };
      if (held !== null && !taking.has(primitiveName)) facts.sharedWith = makeKeyword([...root, ...declared].find(([, record]) => builtinOf(bindingValueOf(record)) === held)[0]);
      throw new BuiltinPrimitiveNamesNoBuiltinError(facts);
    }
    root = new Map([...root, ...declared]);
  }
  return new Map(scope).set(ROOT_KEY, root);
}


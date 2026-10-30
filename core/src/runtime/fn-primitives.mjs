// [QSBLD#fn]

import { registerPrimitive, registerStateReader } from '../primitives.mjs';
import { declareRefusal, refusingAPart } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { commandStep, declarationStep } from '../steps.mjs';
import { inputsOfFunction } from '../eval.mjs';
import { chainOfFn, FN_COMMAND_NAMES, ARGS_NAME, FnCommandNotTakenError } from '../chain.mjs';
import {
  isQuote, isVec, isNull, isBuiltinDescriptor, isErrorValue, isFn, commandsOf, recipeOf,
  makeTag, makeTagged, makeQuote, holdsNoOtherTag, FN_TAG_NAME
} from '../types.mjs';

const FN_TAG = makeTag(FN_TAG_NAME);
const NO_COMMANDS = makeQuote([]);

const FnPayloadNotPairError = declareRefusal('fn/PayloadNotPairError');
const FnRecipeKindNotTakenError = declareRefusal('fn/RecipeKindNotTakenError');
const FnFillRecipeKindNotTakenError = declareRefusal('fn/fill/RecipeKindNotTakenError');

function madeFn(commands, recipe) {
  if (!(isNull(recipe) || isQuote(recipe) || isBuiltinDescriptor(recipe))) throw new FnRecipeKindNotTakenError({ expected: kindsExpected('builtin', 'null', 'quote'), found: recipe });
  const fn = makeTagged(FN_TAG, Object.freeze([commands, recipe]));
  chainOfFn(fn);
  if (isQuote(recipe)) refuseTheArgsShadowed(commands);
  return fn;
}

// [QSBLD#input]
function refuseTheArgsShadowed(commands) {
  const takes = commands.find(step => step.get('name').name === 'takes' && step.get('modifiers')[0].name === ARGS_NAME);
  if (takes !== undefined) throw new FnCommandNotTakenError({ command: makeQuote([takes]), index: 0, found: takes.get('modifiers')[0] });
}

registerPrimitive('fn', payload => {
  if (!isVec(payload) || !holdsNoOtherTag(payload, FN_TAG_NAME) || payload.length !== 2 || !isQuote(payload[0])) throw new FnPayloadNotPairError({ found: payload });
  return madeFn(...payload);
});

// [QSDSP#tagname]
function functionOf(subject) {
  return isFn(subject) ? subject : makeTagged(FN_TAG, Object.freeze([NO_COMMANDS, null]));
}

// [QSBLD#fn]
for (const command of FN_COMMAND_NAMES) {
  registerPrimitive(`fn/${command}`, (subject, modifiers) => {
    const fn = functionOf(subject);
    return madeFn(makeQuote([...commandsOf(fn), commandStep(command, [...modifiers])]), recipeOf(fn));
  });
}

registerPrimitive('fn/impl', (subject, recipe) => madeFn(commandsOf(functionOf(subject)), recipe));

registerStateReader('fn/fill', async (fn, args, state) => {
  const recipe = recipeOf(fn);
  if (!isQuote(recipe)) throw refusingAPart(new FnFillRecipeKindNotTakenError({ 'subject/expected': kindsExpected('quote') }), 1);
  const values = await inputsOfFunction(fn, [...args], state);
  if (isErrorValue(values)) return values;
  return makeQuote([...chainOfFn(fn).inputs.map(({ name, page }, at) => declarationStep(name.name, [page], values[at])), ...recipe]);
});

registerPrimitive('fn/inputs', fn => Object.freeze(chainOfFn(fn).inputs.map(({ name, page, selector, written }) =>
  new Map([['name', name], ['page', page], ['selector', selector], ['kinds', written]]))));

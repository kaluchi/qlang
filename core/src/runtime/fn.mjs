// The function [QSBLD#fn]: the constructor of `::fn`, which reads a
// function from its literal, the chain that built it folded into data, and the
// verbs that build one from the noun by commands, `on`, `takes`, `returns`,
// `throws`, `carries`, `holds`, `proves` and `impl`, each writing its command
// after the ones its chain holds, a step whose modifiers are the args it was
// given, which prints as the command and reads back as the same step; `fill`,
// which writes the args of a call into the head of its code, and `inputs`,
// which reads its inputs.

import { registerPrimitive, registerStateReader } from '../primitives.mjs';
import { declareRefusal, refusingAPart } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { commandStep, declarationStep } from '../steps.mjs';
import { inputsOfFunction } from '../eval.mjs';
import { chainOfFn, FN_COMMAND_NAMES } from '../chain.mjs';
import {
  isQuote, isVec, isNull, isBuiltinDescriptor, isErrorValue, isFn, commandsOf, recipeOf,
  makeTag, makeTagged, makeQuote, holdsNoOtherTag, FN_TAG_NAME
} from '../types.mjs';

const FN_TAG = makeTag(FN_TAG_NAME);
const NO_COMMANDS = makeQuote([]);

const FnPayloadNotPairError = declareRefusal('fn/PayloadNotPairError');
const FnRecipeKindNotTakenError = declareRefusal('fn/RecipeKindNotTakenError');
const FnFillRecipeKindNotTakenError = declareRefusal('fn/fill/RecipeKindNotTakenError');

// A function of its commands and a recipe, held here on every road to one: a
// recipe that is no code and a command its chain does not take are refused [D389].
function madeFn(commands, recipe) {
  if (!(isNull(recipe) || isQuote(recipe) || isBuiltinDescriptor(recipe))) throw new FnRecipeKindNotTakenError({ expected: kindsExpected('builtin', 'null', 'quote'), actualValue: recipe });
  const fn = makeTagged(FN_TAG, Object.freeze([commands, recipe]));
  chainOfFn(fn);
  return fn;
}

// `::fn[commands recipe]` — a function from its literal: the quote of the
// commands of its chain, and its recipe, a quote, a host's primitive, or null
// for a contract no call runs; a payload that is no such pair is refused.
registerPrimitive('fn/construct', payload => {
  if (!isVec(payload) || !holdsNoOtherTag(payload, FN_TAG_NAME) || payload.length !== 2 || !isQuote(payload[0])) throw new FnPayloadNotPairError({ actualValue: payload });
  return madeFn(...payload);
});

// The function a command of its chain runs on: a function, or the noun
// itself, which starts the one of no commands and no recipe; the call
// refuses a tag of another noun before the command runs [QSDSP#tagname].
function functionOf(subject) {
  return isFn(subject) ? subject : makeTagged(FN_TAG, Object.freeze([NO_COMMANDS, null]));
}

// Each command of a chain, `takes :by |~~ How much. ~~| /0 ::number`, written
// by its verb after the ones the function holds with the objects the verb is
// called with, as written, which the chain holds [QSBLD#fn].
for (const command of FN_COMMAND_NAMES) {
  registerPrimitive(`fn/${command}`, (subject, objects) => {
    const fn = functionOf(subject);
    return madeFn(makeQuote([...commandsOf(fn), commandStep(command, [...objects])]), recipeOf(fn));
  });
}

// `impl ~(add by)` — the recipe of the function it builds, of no commands over the noun.
registerPrimitive('fn/impl', (subject, recipe) => madeFn(commandsOf(functionOf(subject)), recipe));

// `fill 3` — the args of a call written into the head of the code,
// each input a declaration with its page of the value it reads, as its call
// reads it; the code answers, a recipe that is no quote refused as the part
// of the subject it is [D389].
registerStateReader('fn/fill', async (fn, args, state) => {
  const recipe = recipeOf(fn);
  if (!isQuote(recipe)) throw refusingAPart(new FnFillRecipeKindNotTakenError({ expected: kindsExpected('quote'), actualValue: recipe }), 1);
  const values = await inputsOfFunction(fn, [...args], state);
  if (isErrorValue(values)) return values;
  return makeQuote([...chainOfFn(fn).inputs.map(({ name, page }, at) => declarationStep(name.name, [page], values[at])), ...recipe]);
});

// `inputs` — the inputs, each a map of its name, its page, its place and
// its kinds as written, null where it names none.
registerPrimitive('fn/inputs', fn => Object.freeze(chainOfFn(fn).inputs.map(({ name, page, place, written }) =>
  new Map([['name', name], ['page', page], ['place', place], ['kinds', written]]))));

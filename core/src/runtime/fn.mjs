// The function [QSBLD#fn]: the constructor of `::fn`, which reads a
// function from its literal, the chain that built it folded into data, and the
// verbs that build one from the noun by commands, `on`, `takes`, `returns`,
// `throws`, `carries`, `holds`, `proves` and `impl`, each writing its command
// after the ones its chain holds, a step whose modifiers are the args it was
// given, which prints as the command and reads back as the same step; `fill`,
// which writes the args of a call into the head of its code, and `inputs`,
// which reads its inputs.

import { registerPrimitive, registerStateReader } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { commandStep, declarationStep } from '../steps.mjs';
import { inputsOfFunction } from '../eval.mjs';
import { chainOfFn } from '../chain.mjs';
import {
  isQuote, isVec, isNull, isBuiltinDescriptor, isErrorValue, isFn, commandsOf, recipeOf,
  makeTag, makeTagged, makeQuote, holdsNoOtherTag, FN_TAG_NAME
} from '../types.mjs';

const FN_TAG = makeTag(FN_TAG_NAME);
const NO_COMMANDS = makeQuote([]);

const FnPayloadNotPairError = declareRefusal('fn/PayloadNotPairError');
const FnRecipeNotCodeError = declareRefusal('fn/RecipeNotCodeError');
const FnFillRecipeNotCodeError = declareRefusal('fn/fill/RecipeNotCodeError');

// A function of its commands and a recipe, held here on every road to one: a
// recipe that is no code and a command its chain does not take are refused [QSBLD#fn].
function madeFn(commands, recipe) {
  if (!(isNull(recipe) || isQuote(recipe) || isBuiltinDescriptor(recipe))) throw new FnRecipeNotCodeError({ actualValue: recipe });
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

// A function with a command written after the ones its chain holds.
function withCommand(fn, command, args) {
  return madeFn(makeQuote([...commandsOf(fn), commandStep(command, args.filter(arg => arg !== null))]), recipeOf(fn));
}

// `on |~~ A number. ~~| ::number` — the subject, its page and its kinds.
registerPrimitive('fn/on', (subject, page, kinds) =>
  withCommand(functionOf(subject), 'on', [page, kinds]));

// `takes :by |~~ How much. ~~| /0 ::number` — an input, its page, the place
// of the args it reads and its kinds.
registerPrimitive('fn/takes', (subject, name, page, place, kinds) =>
  withCommand(functionOf(subject), 'takes', [name, page, place, kinds]));

// `returns |~~ The sum. ~~| ::number` — the answer, its page and its kinds.
registerPrimitive('fn/returns', (subject, page, kinds) =>
  withCommand(functionOf(subject), 'returns', [page, kinds]));

// `throws :TooBigError |~~ A sum past a bound. ~~|` — a refusal and its
// page.
registerPrimitive('fn/throws', (subject, name, page) =>
  withCommand(functionOf(subject), 'throws', [name, page]));

// `carries :TooBigError/bound |~~ The bound. ~~| ::number` — a fact a
// refusal carries, its page and its kinds.
registerPrimitive('fn/carries', (subject, name, page, kinds) =>
  withCommand(functionOf(subject), 'carries', [name, page, kinds]));

// `holds :by/TooBigError |~~ A sum past a bound. ~~| ~(lt 100)` — an
// invariant of an input or of the answer: the refusal of a value that
// breaks it, its page and its condition.
registerPrimitive('fn/holds', (subject, name, page, condition) =>
  withCommand(functionOf(subject), 'holds', [name, page, condition]));

// `proves :addsBy |~~ Five and three is eight. ~~| ~(5 | plus 3 | eq 8)` —
// a law, the claim its name makes, its page and the query that proves it,
// under a name the function declares where it is written with a path.
registerPrimitive('fn/proves', (subject, name, page, query) =>
  withCommand(functionOf(subject), 'proves', [name, page, query]));

// `impl ~(add by)` — the recipe of the function it builds, of no commands over the noun.
registerPrimitive('fn/impl', (subject, recipe) => madeFn(commandsOf(functionOf(subject)), recipe));

// `fill 3` — the args of a call written into the head of the code,
// each input a declaration with its page of the value it reads, as its call
// reads it; the code answers.
registerStateReader('fn/fill', async (fn, args, state) => {
  const recipe = recipeOf(fn);
  if (!isQuote(recipe)) throw new FnFillRecipeNotCodeError({ actualValue: fn });
  const values = await inputsOfFunction(fn, [...args], state);
  if (isErrorValue(values)) return values;
  return makeQuote([...chainOfFn(fn).inputs.map(({ name, page }, at) => declarationStep(name.name, [page], values[at])), ...recipe]);
});

// `inputs` — the inputs, each a map of its name, its page, its place and
// its kinds as written, null where it names none.
registerPrimitive('fn/inputs', fn => Object.freeze(chainOfFn(fn).inputs.map(({ name, page, place, written }) =>
  new Map([['name', name], ['page', page], ['place', place], ['kinds', written]]))));

// The function [D251]: the constructor of `::fn`, which reads a function
// from its literal, the chain that built it folded into data, and the
// words that build one from the noun by commands, `on`, `takes`,
// `returns`, `throws`, `carries`, `holds`, `proves` and `impl`, each
// writing its command after the ones the signature holds, a step of the objects it
// was given, which prints as the command and reads back as the same step;
// `fill`, which writes the arguments of a call into the head of its code,
// and `params`, which reads its inputs.

import { bindPrim, bindStateReader } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { commandStep, declarationStep } from '../quote.mjs';
import { inputsOfFunction } from '../eval.mjs';
import { signatureOf } from './signature.mjs';
import {
  isQuote, isVec, isNull, isBuiltinDescriptor, isErrorValue, isFn, commandsOf, recipeOf,
  makeTag, makeTaggedInstance, makeQuote, FN_TAG_NAME
} from '../types.mjs';

const FN_TAG = makeTag(FN_TAG_NAME);
const EMPTY_SIGNATURE = makeQuote([]);

const FnPayloadNotPairError = declareRefusal('fn/PayloadNotPairError');
const FnRecipeNotCodeError = declareRefusal('fn/RecipeNotCodeError');
const FnOnSubjectNotFnError = declareRefusal('fn/on/SubjectNotFnError');
const FnTakesSubjectNotFnError = declareRefusal('fn/takes/SubjectNotFnError');
const FnReturnsSubjectNotFnError = declareRefusal('fn/returns/SubjectNotFnError');
const FnThrowsSubjectNotFnError = declareRefusal('fn/throws/SubjectNotFnError');
const FnCarriesSubjectNotFnError = declareRefusal('fn/carries/SubjectNotFnError');
const FnHoldsSubjectNotFnError = declareRefusal('fn/holds/SubjectNotFnError');
const FnProvesSubjectNotFnError = declareRefusal('fn/proves/SubjectNotFnError');
const FnImplSubjectNotFnError = declareRefusal('fn/impl/SubjectNotFnError');
const FnFillRecipeNotCodeError = declareRefusal('fn/fill/RecipeNotCodeError');

// A function of a signature and a recipe, its signature read here, so one
// its commands do not declare is refused where the function is made.
function madeFn(signature, recipe) {
  const fn = makeTaggedInstance(FN_TAG, Object.freeze([signature, recipe]));
  signatureOf(fn);
  return fn;
}

// `::fn[signature recipe]` — a function from its literal: the quote of the
// commands of its signature, and its recipe, a quote, a host's primitive,
// or null for a contract no call runs.
bindPrim('fn/construct', payload => {
  if (!isVec(payload) || payload.length !== 2) throw new FnPayloadNotPairError({ actualValue: payload });
  const [signature, recipe] = payload;
  if (!(isNull(recipe) || isQuote(recipe) || isBuiltinDescriptor(recipe))) throw new FnRecipeNotCodeError({ actualValue: recipe });
  return madeFn(signature, recipe);
});

// The function a builder runs on: a function, or the noun itself, which
// starts the one of no commands and no recipe; a tag of another noun, which
// the builder's subject takes beside the function, is refused.
function functionOf(subject, SubjectError) {
  if (isFn(subject)) return subject;
  if (subject.name !== FN_TAG_NAME) throw new SubjectError({ actualValue: subject });
  return makeTaggedInstance(FN_TAG, Object.freeze([EMPTY_SIGNATURE, null]));
}

// A function with a command written after the ones its signature holds.
function withCommand(fn, command, objects) {
  return madeFn(makeQuote([...commandsOf(fn), commandStep(command, objects.filter(object => object !== null))]), recipeOf(fn));
}

// `on |~~ A number. ~~| ::number` — the subject, its page and its kinds.
bindPrim('fn/on', (subject, page, kinds) =>
  withCommand(functionOf(subject, FnOnSubjectNotFnError), 'on', [page, kinds]));

// `takes :by |~~ How much. ~~| /0 ::number` — an input, its page, the place
// of the call it reads and its kinds.
bindPrim('fn/takes', (subject, name, page, place, kinds) =>
  withCommand(functionOf(subject, FnTakesSubjectNotFnError), 'takes', [name, page, place, kinds]));

// `returns |~~ The sum. ~~| ::number` — the answer, its page and its kinds.
bindPrim('fn/returns', (subject, page, kinds) =>
  withCommand(functionOf(subject, FnReturnsSubjectNotFnError), 'returns', [page, kinds]));

// `throws :TooBigError |~~ A sum past a bound. ~~|` — a refusal and its
// page.
bindPrim('fn/throws', (subject, name, page) =>
  withCommand(functionOf(subject, FnThrowsSubjectNotFnError), 'throws', [name, page]));

// `carries :TooBigError/bound |~~ The bound. ~~| ::number` — a fact a
// refusal carries, its page and its kinds.
bindPrim('fn/carries', (subject, name, page, kinds) =>
  withCommand(functionOf(subject, FnCarriesSubjectNotFnError), 'carries', [name, page, kinds]));

// `holds :by/TooBigError |~~ A sum past a bound. ~~| ~(lt 100)` — an
// invariant of an input or of the answer: the refusal of a value that
// breaks it, its page and its condition.
bindPrim('fn/holds', (subject, name, page, condition) =>
  withCommand(functionOf(subject, FnHoldsSubjectNotFnError), 'holds', [name, page, condition]));

// `proves :addsBy |~~ Five and three is eight. ~~| ~(5 | plus 3 | eq 8)` —
// a law, the claim its name makes, its page and the query that proves it,
// under a name the function declares where it is written with a path.
bindPrim('fn/proves', (subject, name, page, query) =>
  withCommand(functionOf(subject, FnProvesSubjectNotFnError), 'proves', [name, page, query]));

// `impl ~(add by)` — the recipe; a function of no commands is its code.
bindPrim('fn/impl', (subject, recipe) => {
  const fn = functionOf(subject, FnImplSubjectNotFnError);
  return commandsOf(fn).length === 0 && isQuote(recipe) ? recipe : madeFn(commandsOf(fn), recipe);
});

// `fill 3` — the arguments of a call written into the head of the code,
// each input a declaration with its page of the value it reads, as its call
// reads it; the code answers.
bindStateReader('fn/fill', async (fn, args, state) => {
  const recipe = recipeOf(fn);
  if (!isQuote(recipe)) throw new FnFillRecipeNotCodeError({ actualValue: fn });
  const values = await inputsOfFunction(fn, [...args], state);
  if (isErrorValue(values)) return values;
  return makeQuote([...signatureOf(fn).inputs.map(({ name, page }, at) => declarationStep(name.name, [page], values[at])), ...recipe]);
});

// `params` — the inputs, each a map of its name, its page, its place and
// its kinds as written, null where it names none.
bindPrim('fn/params', fn => Object.freeze(signatureOf(fn).inputs.map(({ name, page, place, written }) =>
  new Map([['name', name], ['page', page], ['place', place], ['kinds', written]]))));

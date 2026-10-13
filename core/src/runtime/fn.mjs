// The function [D251]: the constructor of `::fn`, which reads a function
// from its literal, the chain that built it folded into data, and the
// words that build one from the noun by commands, `on`, `takes`,
// `returns`, `throws`, `holds` and `impl`, each writing its command after
// the ones the signature holds and reading the signature back, so a
// function holds what its print shows; `fill`, which writes the arguments
// of a call into the head of its code, and `params`, which reads its
// inputs.

import { bindPrim, bindStateReader } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { quoteOfSource, printQuoteSource } from '../quote.mjs';
import { printValue } from './print-value.mjs';
import { inputsOfFunction } from '../eval.mjs';
import { signatureOf } from './signature.mjs';
import {
  isQuote, isVec, isNull, isBuiltinDescriptor, isErrorValue, isFn, fnSignatureOf, fnRecipeOf,
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
const FnHoldsSubjectNotFnError = declareRefusal('fn/holds/SubjectNotFnError');
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

// A function with a command written after the ones its signature holds,
// its objects as their literals, an object left out not written.
function withCommand(fn, command, objects) {
  const text = [command, ...objects.filter(object => object !== null).map(object => printValue(object))].join(' ');
  const before = printQuoteSource(fnSignatureOf(fn));
  return madeFn(quoteOfSource(before === '' ? text : `${before} | ${text}`), fnRecipeOf(fn));
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

// `holds :by/TooBigError |~~ A sum past a bound. ~~| ~(lt 100)` — an
// invariant of an input or of the answer: the refusal of a value that
// breaks it, its page and its condition.
bindPrim('fn/holds', (subject, name, page, condition) =>
  withCommand(functionOf(subject, FnHoldsSubjectNotFnError), 'holds', [name, page, condition]));

// `impl ~(add by)` — the recipe; a function of no commands is its code.
bindPrim('fn/impl', (subject, recipe) => {
  const fn = functionOf(subject, FnImplSubjectNotFnError);
  return fnSignatureOf(fn).length === 0 && isQuote(recipe) ? recipe : madeFn(fnSignatureOf(fn), recipe);
});

// `fill 3` — the arguments of a call written into the head of the code,
// each input a declaration with its page of the value it reads, as its call
// reads it; the code answers.
bindStateReader('fn/fill', async (fn, args, state) => {
  const recipe = fnRecipeOf(fn);
  if (!isQuote(recipe)) throw new FnFillRecipeNotCodeError({ actualValue: fn });
  const values = await inputsOfFunction(fn, [...args], state);
  if (isErrorValue(values)) return values;
  const heads = signatureOf(fn).inputs.map(({ name, page }, at) => `${name.literal} ${printValue(page)} ${printValue(values[at])}`);
  return quoteOfSource([...heads, printQuoteSource(recipe)].filter(text => text !== '').join(' | '));
});

// `params` — the inputs, each a map of its name, its page, its place and
// its kinds as written, null where it names none.
bindPrim('fn/params', fn => Object.freeze(signatureOf(fn).inputs.map(({ name, page, place, written }) =>
  new Map([['name', name], ['page', page], ['place', place], ['kinds', written]]))));

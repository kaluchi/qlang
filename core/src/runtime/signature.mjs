// The signature of a function [D251]: the commands its literal holds, the
// chain that built it folded into data, read once for each function as
// the roles they declare: `on` the subject its call serves, `takes` an
// input the call reads from its args, `returns` the answer, `throws` a
// refusal it pages, `holds` an invariant of an input or of the answer, and
// `law` a law that proves the claim its name makes.

import { declareRefusal } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { isDoc, isKeyword, isPath, isQSet, isQuote, isTag, keyword, makeDoc, makeTag, fnSignatureOf, TAG_HEADER_SYMBOL } from '../types.mjs';
import { elementsRefusalAddress, kindsRefusalAddress, placesOfSelectors, selectorOfPlace } from './nouns.mjs';

const FnSignatureNotCommandsError = declareRefusal('fn/SignatureNotCommandsError');
const FnNameDeclaredTwiceError = declareRefusal('fn/NameDeclaredTwiceError');
const FnNameUnderNoInputError = declareRefusal('fn/NameUnderNoInputError');
const FnLawUnderNoNameError = declareRefusal('fn/LawUnderNoNameError');

export const ANSWER_NAME = 'answer';
export const SUBJECT_NAME = 'subject';

// The objects each command takes, in their order, the last ones left out
// where the command may leave them: an input's name is a name its recipe
// reads as a step, of one segment, beside the names of the subject and the
// answer and the words of a literal; a refusal's name is read as a tag;
// kinds are a tag or a set of tags, and the kinds of an input a vector of
// them besides, the kinds of each of its elements.
const NOT_INPUT_NAMES = new Set([ANSWER_NAME, SUBJECT_NAME, 'true', 'false', 'null']);
const isRefusalName = value => isKeyword(value) && readsAsBareKeyword(value.name);
const isInputName = value => isRefusalName(value) && !value.name.includes('/') && !NOT_INPUT_NAMES.has(value.name);
const isPlace = value => isPath(value) || isQuote(value);
const isKinds = value => isTag(value) || (isQSet(value) && value.length > 0 && value.every(isTag));
const isPlainVec = value => Array.isArray(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isInputKinds = value => isKinds(value) || (isPlainVec(value) && value.length === 1 && isKinds(value[0]));

const COMMANDS = new Map([
  ['on', { taken: [isDoc], optional: [isKinds] }],
  ['takes', { taken: [isInputName, isDoc, isPlace], optional: [isInputKinds] }],
  ['returns', { taken: [isDoc, isKinds], optional: [] }],
  ['throws', { taken: [isRefusalName, isDoc], optional: [] }],
  ['holds', { taken: [isRefusalName, isDoc, isQuote], optional: [] }],
  ['law', { taken: [isRefusalName, isDoc, isQuote], optional: [] }]
]);

// The objects of a step that is one of the commands in the shapes it
// takes, or null.
function objectsOf(step) {
  if (step?.[TAG_HEADER_SYMBOL]?.name !== 'call' || !COMMANDS.has(step.get('name').name)) return null;
  const { taken, optional } = COMMANDS.get(step.get('name').name);
  const objects = step.get('modifiers') ?? [];
  if (objects.length < taken.length || objects.length > taken.length + optional.length) return null;
  return objects.every((object, at) => [...taken, ...optional][at](object)) ? objects : null;
}

// The names of the kinds a tag or a set of tags names, or null for any
// value, which names no kind or names `::any`.
function kindsOf(value) {
  const names = value === undefined ? [] : isTag(value) ? [value.name] : value.map(tag => tag.name);
  return names.length === 0 || names.includes('any') ? null : names;
}

// readSignature(quote) → the roles a quote of commands declares, in the
// order they are written: a name is declared once, the subject and the
// answer each by its own name, a refusal or an invariant written with a
// path is named under an input taken before it or under the answer, and a
// law written with one under a name the signature declares before it, the
// refusal an input's kinds name among them.
export function readSignature(quote) {
  if (!isQuote(quote)) throw new FnSignatureNotCommandsError({ actualValue: quote });
  const signature = { subject: null, inputs: [], answer: null, pages: new Map(), invariants: [], laws: [] };
  const declared = new Set();
  const named = new Set();
  const declare = name => {
    if (declared.has(name)) throw new FnNameDeclaredTwiceError({ name: keyword(name), actualValue: quote });
    declared.add(name);
    named.add(name);
  };
  const underAnInput = name => {
    const [head] = name.split('/');
    if (head !== ANSWER_NAME && !signature.inputs.some(input => input.name.name === head)) throw new FnNameUnderNoInputError({ name: keyword(name), actualValue: quote });
  };
  for (const step of quote) {
    const objects = objectsOf(step);
    if (objects === null) throw new FnSignatureNotCommandsError({ actualValue: quote });
    const [first, second, third, fourth] = objects;
    switch (step.get('name').name) {
      case 'on':
        declare(SUBJECT_NAME);
        signature.subject = { page: first, kinds: kindsOf(second), written: second ?? null };
        break;
      case 'takes': {
        declare(first.name);
        const each = isPlainVec(fourth);
        const kinds = kindsOf(each ? fourth[0] : fourth);
        if (kinds !== null) named.add((each ? elementsRefusalAddress : kindsRefusalAddress)(first.name, kinds));
        signature.inputs.push({ name: first, page: second, place: third, kinds, each, written: fourth ?? null, selector: selectorOfPlace(third) });
        break;
      }
      case 'returns':
        declare(ANSWER_NAME);
        signature.answer = { page: first, kinds: kindsOf(second), written: second };
        break;
      case 'throws':
        if (first.name.includes('/')) underAnInput(first.name);
        declare(first.name);
        signature.pages.set(first.name, second);
        break;
      case 'holds':
        if (!first.name.includes('/')) throw new FnNameUnderNoInputError({ name: first, actualValue: quote });
        underAnInput(first.name);
        declare(first.name);
        signature.invariants.push({ name: first.name, page: second, condition: third });
        break;
      default:
        if (first.name.includes('/') && !named.has(first.name.slice(0, first.name.lastIndexOf('/')))) throw new FnLawUnderNoNameError({ name: first, actualValue: quote });
        declare(first.name);
        signature.laws.push({ name: first.name, page: second, query: third });
    }
  }
  signature.places = placesOfSelectors(signature.inputs.map(input => input.selector));
  return Object.freeze(signature);
}

// signatureOf(fn) → the roles of a function's signature, read once.
const SIGNATURES = new WeakMap();

export function signatureOf(fn) {
  let signature = SIGNATURES.get(fn);
  if (signature === undefined) SIGNATURES.set(fn, signature = readSignature(fnSignatureOf(fn)));
  return signature;
}

// pageOfKindsRefusal(name, kinds, each) → the page of the refusal an
// input's kinds name where `throws` gives it none: the input, or each of
// its elements, and its kinds.
export function pageOfKindsRefusal(name, kinds, each) {
  const literals = kinds.map(kind => `\`${makeTag(kind).literal}\``);
  const listed = literals.length === 1 ? literals[0] : `${literals.slice(0, -1).join(', ')} or ${literals.at(-1)}`;
  const holder = each ? `Each element of \`${name.name}\`` : `\`${name.name}\``;
  return makeDoc([` ${holder} holds a value of ${listed}. `]);
}

// invariantsOf(signature, name) → the invariants written under an input or
// under the answer, in their order.
export function invariantsOf(signature, name) {
  return signature.invariants.filter(invariant => invariant.name.startsWith(`${name}/`));
}

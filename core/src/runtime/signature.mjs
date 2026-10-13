// The signature of a function [D251]: the commands its literal holds, the
// chain that built it folded into data, read once for each function as
// the roles they declare: `on` the subject its call serves, `takes` an
// input the call reads from its args, `returns` the answer, `throws` a
// refusal it pages and `holds` an invariant of an input or of the answer.

import { declareRefusal } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { isDoc, isKeyword, isPath, isQSet, isQuote, isTag, keyword, makeDoc, makeTag, fnSignatureOf, TAG_HEADER_SYMBOL } from '../types.mjs';
import { placesOfSelectors, selectorOfPlace } from './nouns.mjs';

const FnSignatureNotCommandsError = declareRefusal('fn/SignatureNotCommandsError');
const FnNameDeclaredTwiceError = declareRefusal('fn/NameDeclaredTwiceError');
const FnNameUnderNoInputError = declareRefusal('fn/NameUnderNoInputError');

export const ANSWER_NAME = 'answer';
export const SUBJECT_NAME = 'subject';

// The objects each command takes, in their order, the last ones left out
// where the command may leave them: an input's name is a name its recipe
// reads as a step, of one segment, beside the names of the subject and the
// answer and the words of a literal; a refusal's name is read as a tag;
// and kinds are a tag or a set of tags.
const NOT_INPUT_NAMES = new Set([ANSWER_NAME, SUBJECT_NAME, 'true', 'false', 'null']);
const isRefusalName = value => isKeyword(value) && readsAsBareKeyword(value.name);
const isInputName = value => isRefusalName(value) && !value.name.includes('/') && !NOT_INPUT_NAMES.has(value.name);
const isPlace = value => isPath(value) || isQuote(value);
const isKinds = value => isTag(value) || (isQSet(value) && value.length > 0 && value.every(isTag));

const COMMANDS = new Map([
  ['on', { taken: [isDoc], optional: [isKinds] }],
  ['takes', { taken: [isInputName, isDoc, isPlace], optional: [isKinds] }],
  ['returns', { taken: [isDoc, isKinds], optional: [] }],
  ['throws', { taken: [isRefusalName, isDoc], optional: [] }],
  ['holds', { taken: [isRefusalName, isDoc, isQuote], optional: [] }]
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
// answer each by its own name, and a refusal or an invariant written with
// a path is named under an input taken before it or under the answer.
export function readSignature(quote) {
  if (!isQuote(quote)) throw new FnSignatureNotCommandsError({ actualValue: quote });
  const signature = { subject: null, inputs: [], answer: null, pages: new Map(), invariants: [] };
  const declared = new Set();
  const declare = name => {
    if (declared.has(name)) throw new FnNameDeclaredTwiceError({ name: keyword(name), actualValue: quote });
    declared.add(name);
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
      case 'takes':
        declare(first.name);
        signature.inputs.push({ name: first, page: second, place: third, kinds: kindsOf(fourth), written: fourth ?? null, selector: selectorOfPlace(third) });
        break;
      case 'returns':
        declare(ANSWER_NAME);
        signature.answer = { page: first, kinds: kindsOf(second), written: second };
        break;
      case 'throws':
        if (first.name.includes('/')) underAnInput(first.name);
        declare(first.name);
        signature.pages.set(first.name, second);
        break;
      default:
        if (!first.name.includes('/')) throw new FnNameUnderNoInputError({ name: first, actualValue: quote });
        underAnInput(first.name);
        declare(first.name);
        signature.invariants.push({ name: first.name, page: second, condition: third });
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

// pageOfKindsRefusal(name, kinds) → the page of the refusal an input's
// kinds name where `throws` gives it none: the input and its kinds.
export function pageOfKindsRefusal(name, kinds) {
  const literals = kinds.map(kind => `\`${makeTag(kind).literal}\``);
  const listed = literals.length === 1 ? literals[0] : `${literals.slice(0, -1).join(', ')} or ${literals.at(-1)}`;
  return makeDoc([` \`${name.name}\` holds a value of ${listed}. `]);
}

// invariantsOf(signature, name) → the invariants written under an input or
// under the answer, in their order.
export function invariantsOf(signature, name) {
  return signature.invariants.filter(invariant => invariant.name.startsWith(`${name}/`));
}

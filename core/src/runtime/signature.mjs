// The commands of a function [D251] and of a kind [D252]: the quote its
// literal holds, the chain that built it folded into data, read once for
// each value as the roles they declare, each command a verb its value is
// the subject of. A function's: `on` the subject its call serves, `takes`
// an input the call reads from its args, `returns` the answer, `throws` a
// refusal it pages, `carries` a fact a refusal carries, `holds` an
// invariant of an input or of the answer, and `proves` a law, the claim its
// name makes and the query that proves it. A kind's: `wraps` the payload
// its tag is laid over, `reads` a field of the payload, `tells` a page of
// the kind on a name, a chapter of a topic among them, `carries`, `holds`
// an invariant of its value or of a field, `throws` and `proves`.

import { declareRefusal } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { isDoc, isKeyword, isPath, isQSet, isQuote, isTag, keyword, makeDoc, makeQuote, makeTag, makeTaggedInstance, commandsOf, CALL_TAG, FN_TAG_NAME, TAG_HEADER_SYMBOL } from '../types.mjs';
import { CONSTRUCT_NAME, elementsRefusalAddress, kindsRefusalAddress, notGivenAddress, payloadRefusalName, placesOfSelectors, selectorOfPlace } from './nouns.mjs';

const FnSignatureNotCommandsError = declareRefusal('fn/SignatureNotCommandsError');
const FnNameDeclaredTwiceError = declareRefusal('fn/NameDeclaredTwiceError');
const FnNameUnderNoInputError = declareRefusal('fn/NameUnderNoInputError');
const FnLawUnderNoNameError = declareRefusal('fn/LawUnderNoNameError');
const FnFactUnderNoNameError = declareRefusal('fn/FactUnderNoNameError');
const KindSignatureNotCommandsError = declareRefusal('kind/SignatureNotCommandsError');
const KindNameDeclaredTwiceError = declareRefusal('kind/NameDeclaredTwiceError');
const KindNameUnderNoFieldError = declareRefusal('kind/NameUnderNoFieldError');
const KindLawUnderNoNameError = declareRefusal('kind/LawUnderNoNameError');
const KindFactUnderNoNameError = declareRefusal('kind/FactUnderNoNameError');

export const ANSWER_NAME = 'answer';
export const SUBJECT_NAME = 'subject';
export const PAYLOAD_NAME = 'payload';

// The objects each command takes, in their order, the last ones left out
// where the command may leave them: an input's name is a name its recipe
// reads as a step, of one segment, beside the names of the subject and the
// answer and the words of a literal, and a field's and a page's beside
// `payload` and `construct`; a refusal's name is read as a tag; kinds are
// a tag or a set of tags, and the kinds of an input, of a payload or of a
// field a vector of them besides, the kinds of each of its elements.
const LITERAL_WORDS = new Set(['true', 'false', 'null']);
const isRefusalName = value => isKeyword(value) && readsAsBareKeyword(value.name);
const isNameOfOneSegment = value => isRefusalName(value) && !value.name.includes('/') && !LITERAL_WORDS.has(value.name);
const isInputName = value => isNameOfOneSegment(value) && value.name !== ANSWER_NAME && value.name !== SUBJECT_NAME;
const isFieldName = value => isNameOfOneSegment(value) && value.name !== PAYLOAD_NAME && value.name !== CONSTRUCT_NAME;
const isPlace = value => isPath(value) || isQuote(value);
const isKinds = value => isTag(value) || (isQSet(value) && value.length > 0 && value.every(isTag));
const isPlainVec = value => Array.isArray(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isKindsOfEach = value => isKinds(value) || (isPlainVec(value) && value.length === 1 && isKinds(value[0]));

const COMMANDS = new Map([
  ['on', { taken: [isDoc], optional: [isKinds] }],
  ['takes', { taken: [isInputName, isDoc, isPlace], optional: [isKindsOfEach] }],
  ['returns', { taken: [isDoc, isKinds], optional: [] }],
  ['throws', { taken: [isRefusalName, isDoc], optional: [] }],
  ['carries', { taken: [isRefusalName, isDoc], optional: [isKinds] }],
  ['holds', { taken: [isRefusalName, isDoc, isQuote], optional: [] }],
  ['proves', { taken: [isRefusalName, isDoc, isQuote], optional: [] }]
]);

const KIND_COMMANDS = new Map([
  ['wraps', { taken: [isDoc], optional: [isKindsOfEach] }],
  ['reads', { taken: [isFieldName, isDoc, isPlace], optional: [isKindsOfEach] }],
  ['tells', { taken: [isFieldName, isDoc], optional: [isKinds] }],
  ['carries', { taken: [isRefusalName, isDoc], optional: [isKinds] }],
  ['holds', { taken: [isRefusalName, isDoc, isQuote], optional: [] }],
  ['throws', { taken: [isRefusalName, isDoc], optional: [] }],
  ['proves', { taken: [isRefusalName, isDoc, isQuote], optional: [] }]
]);

// The objects of a step that is one of the commands of a table in the
// shapes it takes, or null.
function objectsOf(step, commands) {
  if (step?.[TAG_HEADER_SYMBOL]?.name !== 'call' || !commands.has(step.get('name').name)) return null;
  const { taken, optional } = commands.get(step.get('name').name);
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

// The kinds of a value or of each of its elements, as `takes`, `wraps` and
// `reads` write them: whether they are of each element, the kinds, and
// the objects as written, null where none are.
function kindsWritten(written) {
  const each = isPlainVec(written);
  return { each, kinds: kindsOf(each ? written[0] : written), written: written ?? null };
}

// The names a quote of commands declares, each once, and the names a law
// or a fact written with a path is named under: those declared and the
// refusals the kinds the commands write name.
function namesOf(quote, DeclaredTwiceError) {
  const declared = new Set();
  const named = new Set();
  return {
    named,
    declare(name) {
      if (declared.has(name)) throw new DeclaredTwiceError({ name: keyword(name), actualValue: quote });
      declared.add(name);
      named.add(name);
    },
    isUnderANamed: name => named.has(name.slice(0, name.lastIndexOf('/')))
  };
}

// readSignature(quote) → the roles a quote of commands declares, in the
// order they are written: a name is declared once, the subject and the
// answer each by its own name, a refusal or an invariant written with a
// path is named under an input taken before it or under the answer, and a
// law or a fact written with one under a name the signature declares
// before it, the refusal an input's kinds name among them; a fact is
// written with a path.
export function readSignature(quote) {
  if (!isQuote(quote)) throw new FnSignatureNotCommandsError({ actualValue: quote });
  const signature = { subject: null, inputs: [], answer: null, pages: new Map(), facts: [], invariants: [], laws: [] };
  const names = namesOf(quote, FnNameDeclaredTwiceError);
  const underAnInput = name => {
    const [head] = name.split('/');
    if (head !== ANSWER_NAME && !signature.inputs.some(input => input.name.name === head)) throw new FnNameUnderNoInputError({ name: keyword(name), actualValue: quote });
  };
  for (const step of quote) {
    const objects = objectsOf(step, COMMANDS);
    if (objects === null) throw new FnSignatureNotCommandsError({ actualValue: quote });
    const [first, second, third, fourth] = objects;
    switch (step.get('name').name) {
      case 'on':
        names.declare(SUBJECT_NAME);
        signature.subject = { page: first, kinds: kindsOf(second), written: second ?? null };
        break;
      case 'takes': {
        names.declare(first.name);
        const { each, kinds, written } = kindsWritten(fourth);
        if (kinds !== null) names.named.add((each ? elementsRefusalAddress : kindsRefusalAddress)(first.name, kinds));
        signature.inputs.push({ name: first, page: second, place: third, kinds, each, written, selector: selectorOfPlace(third) });
        break;
      }
      case 'returns':
        names.declare(ANSWER_NAME);
        signature.answer = { page: first, kinds: kindsOf(second), written: second };
        break;
      case 'throws':
        if (first.name.includes('/')) underAnInput(first.name);
        names.declare(first.name);
        signature.pages.set(first.name, second);
        break;
      case 'carries':
        if (!first.name.includes('/') || !names.isUnderANamed(first.name)) throw new FnFactUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        signature.facts.push({ name: first.name, page: second, written: third ?? null });
        break;
      case 'holds':
        if (!first.name.includes('/')) throw new FnNameUnderNoInputError({ name: first, actualValue: quote });
        underAnInput(first.name);
        names.declare(first.name);
        signature.invariants.push({ name: first.name, page: second, condition: third });
        break;
      default:
        if (first.name.includes('/') && !names.isUnderANamed(first.name)) throw new FnLawUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        signature.laws.push({ name: first.name, page: second, query: third });
    }
  }
  signature.places = placesOfSelectors(signature.inputs.map(input => input.selector));
  return Object.freeze(signature);
}

// readKindSignature(quote) → the roles a quote of the commands of a kind
// declares, in the order they are written [D252]: a name is declared once,
// the payload by its own name and a field and a page `tells` writes by
// theirs; a refusal or an invariant written with a path is named under a
// field declared before it, and a law or a fact written with one under a
// name declared before it, the refusals the kinds of the payload and of a
// field name and the one of a field the payload leaves out among them; a
// fact written with none is a fact of the payload.
export function readKindSignature(quote) {
  if (!isQuote(quote)) throw new KindSignatureNotCommandsError({ actualValue: quote });
  const kind = { payload: null, fields: [], tells: [], pages: new Map(), facts: [], invariants: [], laws: [] };
  const names = namesOf(quote, KindNameDeclaredTwiceError);
  const underAField = name => {
    const [head] = name.split('/');
    if (!kind.fields.some(field => field.name.name === head)) throw new KindNameUnderNoFieldError({ name: keyword(name), actualValue: quote });
    return head;
  };
  for (const step of quote) {
    const objects = objectsOf(step, KIND_COMMANDS);
    if (objects === null) throw new KindSignatureNotCommandsError({ actualValue: quote });
    const [first, second, third, fourth] = objects;
    switch (step.get('name').name) {
      case 'wraps': {
        names.declare(PAYLOAD_NAME);
        const { each, kinds, written } = kindsWritten(second);
        if (kinds !== null) names.named.add(payloadRefusalName(kinds, each));
        if (each) names.named.add(payloadRefusalName(['vec'], false));
        kind.payload = { page: first, kinds, each, written };
        break;
      }
      case 'reads': {
        names.declare(first.name);
        const { each, kinds, written } = kindsWritten(fourth);
        names.named.add(notGivenAddress(first.name));
        if (each) names.named.add(kindsRefusalAddress(first.name, ['vec']));
        if (kinds !== null) names.named.add((each ? elementsRefusalAddress : kindsRefusalAddress)(first.name, kinds));
        kind.fields.push({ name: first, page: second, place: third, kinds, each, written });
        break;
      }
      case 'tells':
        names.declare(first.name);
        kind.tells.push({ name: first.name, page: second, written: third ?? null });
        break;
      case 'carries':
        if (first.name.includes('/') && !names.isUnderANamed(first.name)) throw new KindFactUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        kind.facts.push({ name: first.name, page: second, written: third ?? null });
        break;
      case 'holds': {
        const field = first.name.includes('/') ? underAField(first.name) : null;
        names.declare(first.name);
        kind.invariants.push({ name: first.name, page: second, condition: third, field });
        break;
      }
      case 'throws':
        if (first.name.includes('/')) underAField(first.name);
        names.declare(first.name);
        kind.pages.set(first.name, second);
        break;
      default:
        if (first.name.includes('/') && !names.isUnderANamed(first.name)) throw new KindLawUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        kind.laws.push({ name: first.name, page: second, query: third });
    }
  }
  return Object.freeze(kind);
}

// commandStep(command, objects) → the step of a command of a function or
// of a kind on its objects, an object left out not written, which prints as
// the command and reads back as the same step.
export function commandStep(command, objects) {
  return makeTaggedInstance(CALL_TAG, new Map([['name', keyword(command)], ['modifiers', Object.freeze(objects.filter(object => object !== null))]]));
}

// signatureOf(fn) → the roles of a function's signature, read once.
const SIGNATURES = new WeakMap();

export function signatureOf(fn) {
  let signature = SIGNATURES.get(fn);
  if (signature === undefined) SIGNATURES.set(fn, signature = readSignature(commandsOf(fn)));
  return signature;
}

// functionOfRecipe(recipe) → the function of no commands a recipe is, a
// quote or a host's primitive written as the value of a word [D253], made
// once for the recipe.
const FUNCTIONS_OF_RECIPES = new WeakMap();
const NO_COMMANDS = makeQuote([]);

export function functionOfRecipe(recipe) {
  let fn = FUNCTIONS_OF_RECIPES.get(recipe);
  if (fn === undefined) FUNCTIONS_OF_RECIPES.set(recipe, fn = makeTaggedInstance(makeTag(FN_TAG_NAME), Object.freeze([NO_COMMANDS, recipe])));
  return fn;
}

// kindOf(kind) → the roles of the commands of a kind, read once.
const KINDS = new WeakMap();

export function kindOf(kind) {
  let read = KINDS.get(kind);
  if (read === undefined) KINDS.set(kind, read = readKindSignature(commandsOf(kind)));
  return read;
}

// pageOfKindsRefusal(name, kinds, each) → the page of the refusal the kinds
// of an input, of a payload or of a field name where `throws` gives it
// none: the value, or each of its elements, and its kinds.
export function pageOfKindsRefusal(name, kinds, each) {
  const literals = kinds.map(kind => `\`${makeTag(kind).literal}\``);
  const listed = literals.length === 1 ? literals[0] : `${literals.slice(0, -1).join(', ')} or ${literals.at(-1)}`;
  const holder = each ? `Each element of \`${name.name}\`` : `\`${name.name}\``;
  return makeDoc([` ${holder} holds a value of ${listed}. `]);
}

// pageOfConstructor(address) → the page of the constructor of a kind, the
// recipe `impl` gives it, which builds its values from a payload.
export function pageOfConstructor(address) {
  return makeDoc([` The constructor of \`${makeTag(address).literal}\`, the recipe \`impl\` gives it, which builds its values from a payload. `]);
}

// invariantsOf(signature, name) → the invariants written under an input or
// under the answer, in their order.
export function invariantsOf(signature, name) {
  return signature.invariants.filter(invariant => invariant.name.startsWith(`${name}/`));
}

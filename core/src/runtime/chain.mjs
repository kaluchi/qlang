// The chain of a function and of a kind, the commands that built it folded
// into the quote its literal holds, read once for each value as the roles
// they declare [QSBLD#fn], [QSBLD#kind].

import { declareRefusal } from '../errors.mjs';
import { readsAsBareKeyword, LITERAL_WORDS } from '../name-chars.mjs';
import { isDoc, isKeyword, isPath, isSet, isQuote, isTag, keyword, makeDoc, makeQuote, makeTag, makeTagged, commandsOf, CALL_TAG, FN_TAG_NAME, TAG_HEADER_SYMBOL } from '../types.mjs';
import { ANY_KIND_NAME, CONSTRUCT_NAME, elementsRefusalAddress, kindsRefusalAddress, notGivenAddress, payloadRefusalName, placesOfReadings, readingOfPlace } from './nouns.mjs';

const FnCommandNotTakenError = declareRefusal('fn/CommandNotTakenError');
const FnNameDeclaredTwiceError = declareRefusal('fn/NameDeclaredTwiceError');
const FnNameUnderNoInputError = declareRefusal('fn/NameUnderNoInputError');
const FnLawUnderNoNameError = declareRefusal('fn/LawUnderNoNameError');
const FnFactUnderNoNameError = declareRefusal('fn/FactUnderNoNameError');
const KindCommandNotTakenError = declareRefusal('kind/CommandNotTakenError');
const KindNameDeclaredTwiceError = declareRefusal('kind/NameDeclaredTwiceError');
const KindNameUnderNoFieldError = declareRefusal('kind/NameUnderNoFieldError');
const KindLawUnderNoNameError = declareRefusal('kind/LawUnderNoNameError');
const KindFactUnderNoNameError = declareRefusal('kind/FactUnderNoNameError');

export const ANSWER_NAME = 'answer';
export const SUBJECT_NAME = 'subject';
export const PAYLOAD_NAME = 'payload';

const isNameOfChain = value => isKeyword(value) && readsAsBareKeyword(value.name);
const isNameOfOneSegment = value => isNameOfChain(value) && !value.name.includes('/') && !LITERAL_WORDS.has(value.name);
const isInputName = value => isNameOfOneSegment(value) && value.name !== ANSWER_NAME && value.name !== SUBJECT_NAME;
const isFieldName = value => isNameOfOneSegment(value) && value.name !== PAYLOAD_NAME && value.name !== CONSTRUCT_NAME;
const isPlace = value => isPath(value) || isQuote(value);
const isKinds = value => isTag(value) || (isSet(value) && value.length > 0 && value.every(isTag));
const isPlainVec = value => Array.isArray(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isKindsOfEach = value => isKinds(value) || (isPlainVec(value) && value.length === 1 && isKinds(value[0]));

// The modifiers each command writes, in their order, the last ones left out
// where the command may leave them.
const COMMANDS = new Map([
  ['on', { taken: [isDoc], optional: [isKinds] }],
  ['takes', { taken: [isInputName, isDoc, isPlace], optional: [isKindsOfEach] }],
  ['returns', { taken: [isDoc, isKinds], optional: [] }],
  ['throws', { taken: [isNameOfChain, isDoc], optional: [] }],
  ['carries', { taken: [isNameOfChain, isDoc], optional: [isKinds] }],
  ['holds', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }],
  ['proves', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }]
]);

const KIND_COMMANDS = new Map([
  ['wraps', { taken: [isDoc], optional: [isKindsOfEach] }],
  ['reads', { taken: [isFieldName, isDoc, isPlace], optional: [isKindsOfEach] }],
  ['tells', { taken: [isFieldName, isDoc], optional: [isKinds] }],
  ['carries', { taken: [isNameOfChain, isDoc], optional: [isKinds] }],
  ['holds', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }],
  ['throws', { taken: [isNameOfChain, isDoc], optional: [] }],
  ['proves', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }]
]);

// The names of the commands a chain is written in, those its quote folds and
// `impl`, which gives a function its recipe or a kind its constructor [QSBLD#fn], [QSBLD#kind].
export const COMMAND_NAMES = Object.freeze([...new Set([...COMMANDS.keys(), ...KIND_COMMANDS.keys(), 'impl'])]);

// The modifiers of a step that is one of the commands of a table in the
// forms it takes, or null.
function modifiersOf(step, commands) {
  if (step?.[TAG_HEADER_SYMBOL]?.name !== CALL_TAG.name || !commands.has(step.get('name').name)) return null;
  const { taken, optional } = commands.get(step.get('name').name);
  const modifiers = step.get('modifiers') ?? [];
  if (modifiers.length < taken.length || modifiers.length > taken.length + optional.length) return null;
  return modifiers.every((modifier, at) => [...taken, ...optional][at](modifier)) ? modifiers : null;
}

// The names of the kinds a tag or a set of tags names, or null for any
// value, which names no kind or names `::any`.
function kindsOf(value) {
  const names = value === undefined ? [] : isTag(value) ? [value.name] : value.map(tag => tag.name);
  return names.length === 0 || names.includes(ANY_KIND_NAME) ? null : names;
}

// The kinds of a value or of each of its elements, as `takes`, `wraps` and
// `reads` write them: whether they are of each element, the names of the
// kinds, and the kinds as written, null where none are.
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

// The roles the quote of the commands of a function declares, in their order,
// each name declared once and a name with a path under one declared before
// it, a step written with args the rules of the chain do not take refused.
function readChainOfFn(quote) {
  const chain = { subject: null, inputs: [], answer: null, pages: new Map(), facts: [], invariants: [], laws: [] };
  const names = namesOf(quote, FnNameDeclaredTwiceError);
  const underAnInput = name => {
    const [head] = name.split('/');
    if (head !== ANSWER_NAME && !chain.inputs.some(input => input.name.name === head)) throw new FnNameUnderNoInputError({ name: keyword(name), actualValue: quote });
  };
  for (const step of quote) {
    const modifiers = modifiersOf(step, COMMANDS);
    if (modifiers === null) throw new FnCommandNotTakenError({ actualValue: quote });
    const [first, second, third, fourth] = modifiers;
    switch (step.get('name').name) {
      case 'on':
        names.declare(SUBJECT_NAME);
        chain.subject = { page: first, kinds: kindsOf(second), written: second ?? null };
        break;
      case 'takes': {
        names.declare(first.name);
        const { each, kinds, written } = kindsWritten(fourth);
        names.named.add(notGivenAddress(first.name));
        if (each) names.named.add(kindsRefusalAddress(first.name));
        if (kinds !== null) names.named.add((each ? elementsRefusalAddress : kindsRefusalAddress)(first.name));
        chain.inputs.push({ name: first, page: second, place: third, kinds, each, written, reading: readingOfPlace(third) });
        break;
      }
      case 'returns':
        names.declare(ANSWER_NAME);
        names.named.add(kindsRefusalAddress(ANSWER_NAME));
        chain.answer = { page: first, kinds: kindsOf(second), written: second };
        break;
      case 'throws':
        if (first.name.includes('/')) underAnInput(first.name);
        names.declare(first.name);
        chain.pages.set(first.name, second);
        break;
      case 'carries':
        if (!first.name.includes('/') || !names.isUnderANamed(first.name)) throw new FnFactUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        chain.facts.push({ name: first.name, page: second, written: third ?? null });
        break;
      case 'holds':
        if (!first.name.includes('/')) throw new FnNameUnderNoInputError({ name: first, actualValue: quote });
        underAnInput(first.name);
        if (names.named.has(first.name)) throw new FnNameDeclaredTwiceError({ name: first, actualValue: quote });
        names.declare(first.name);
        chain.invariants.push({ name: first.name, page: second, condition: third });
        break;
      default:
        if (first.name.includes('/') && !names.isUnderANamed(first.name)) throw new FnLawUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        chain.laws.push({ name: first.name, page: second, query: third });
    }
  }
  chain.places = placesOfReadings(chain.inputs.map(input => input.reading));
  return Object.freeze(chain);
}

// The roles the quote of the commands of a kind declares, in their order,
// each name declared once and a name with a path under one declared before
// it, a step written with args the rules of the chain do not take refused.
function readChainOfKind(quote) {
  const kind = { payload: null, fields: [], tells: [], pages: new Map(), facts: [], invariants: [], laws: [] };
  const names = namesOf(quote, KindNameDeclaredTwiceError);
  const underAField = name => {
    const [head] = name.split('/');
    if (!kind.fields.some(field => field.name.name === head)) throw new KindNameUnderNoFieldError({ name: keyword(name), actualValue: quote });
    return head;
  };
  for (const step of quote) {
    const modifiers = modifiersOf(step, KIND_COMMANDS);
    if (modifiers === null) throw new KindCommandNotTakenError({ actualValue: quote });
    const [first, second, third, fourth] = modifiers;
    switch (step.get('name').name) {
      case 'wraps': {
        names.declare(PAYLOAD_NAME);
        const { each, kinds, written } = kindsWritten(second);
        if (kinds !== null) names.named.add(payloadRefusalName(each));
        if (each) names.named.add(payloadRefusalName(false));
        kind.payload = { page: first, kinds, each, written };
        break;
      }
      case 'reads': {
        names.declare(first.name);
        const { each, kinds, written } = kindsWritten(fourth);
        names.named.add(notGivenAddress(first.name));
        if (each) names.named.add(kindsRefusalAddress(first.name));
        if (kinds !== null) names.named.add((each ? elementsRefusalAddress : kindsRefusalAddress)(first.name));
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
        if (names.named.has(first.name)) throw new KindNameDeclaredTwiceError({ name: first, actualValue: quote });
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

// chainOfFn(fn) → the roles of the chain of a function, read once.
const CHAINS_OF_FUNCTIONS = new WeakMap();

export function chainOfFn(fn) {
  let chain = CHAINS_OF_FUNCTIONS.get(fn);
  if (chain === undefined) CHAINS_OF_FUNCTIONS.set(fn, chain = readChainOfFn(commandsOf(fn)));
  return chain;
}

// functionOfRecipe(recipe) → the function of no commands a recipe is, a quote
// or a host's primitive written as the value of a verb [QSBLD#recipe], made once
// for the recipe.
const FUNCTIONS_OF_RECIPES = new WeakMap();
const NO_COMMANDS = makeQuote([]);

export function functionOfRecipe(recipe) {
  let fn = FUNCTIONS_OF_RECIPES.get(recipe);
  if (fn === undefined) FUNCTIONS_OF_RECIPES.set(recipe, fn = makeTagged(makeTag(FN_TAG_NAME), Object.freeze([NO_COMMANDS, recipe])));
  return fn;
}

// chainOfKind(kind) → the roles of the chain of a kind, read once.
const CHAINS_OF_KINDS = new WeakMap();

export function chainOfKind(kind) {
  let chain = CHAINS_OF_KINDS.get(kind);
  if (chain === undefined) CHAINS_OF_KINDS.set(kind, chain = readChainOfKind(commandsOf(kind)));
  return chain;
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
// `::builtin{}` its `impl` gives, which constructs by the primitive a host
// hands beside its source and constructs nothing where none is handed
// [QSBLD#kind], [QSHST#source].
export function pageOfConstructor(address) {
  return makeDoc([` The constructor of \`${makeTag(address).literal}\`, the \`::builtin{}\` \`impl\` gives it, which attaches the tag to a payload or refuses it by the primitive a host hands beside its source, and constructs nothing where none is handed. `]);
}

// invariantsOf(chain, name) → the invariants written under an input or
// under the answer, in their order.
export function invariantsOf(chain, name) {
  return chain.invariants.filter(invariant => invariant.name.startsWith(`${name}/`));
}

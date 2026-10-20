// The chain of a function and of a kind, the commands that built it folded
// into the quote its literal holds, read once for each value as the roles
// they declare and the places its inputs read, on every road to one [QSBLD#fn], [QSBLD#kind].

import { declareRefusal } from './errors.mjs';
import { readsAsBareKeyword, LITERAL_WORDS } from './name-chars.mjs';
import { isDoc, isKeyword, isPath, isSet, isQuote, isTag, keyword, makeDoc, makeQuote, makeTag, makeTagged, commandsOf, FN_TAG_NAME, BUILTIN_TAG, TAG_HEADER_SYMBOL } from './types.mjs';
import { isCallStep, isPathAlone, builtFrom } from './steps.mjs';
import { ANY_KIND_NAME, elementsRefusalAddress, kindsRefusalAddress, notGivenAddress, payloadRefusalName } from './address.mjs';
import { segmentIndex } from './path-read.mjs';

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
export const CONSTRUCT_NAME = 'construct';

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

// The names of the commands of the chain of a function and of a kind, which
// their verbs write, and of every command a chain is written in, `impl`, which
// gives the recipe or the constructor, among them [QSBLD#fn], [QSBLD#kind].
export const FN_COMMAND_NAMES = Object.freeze([...COMMANDS.keys()]);
export const KIND_COMMAND_NAMES = Object.freeze([...KIND_COMMANDS.keys()]);
export const COMMAND_NAMES = Object.freeze([...new Set([...FN_COMMAND_NAMES, ...KIND_COMMAND_NAMES, 'impl'])]);

// isVerbBody(body) → whether the body of a declaration as written is the value of a
// verb: a quote, a `::builtin{}` or a function built from `::fn` [QSNAM#address], [QSHST#tools].
export function isVerbBody(body) {
  return isQuote(body) || [FN_TAG_NAME, BUILTIN_TAG.name].includes(builtFrom(body));
}

// The object of a step a table of commands does not take: `{ index, actualValue }`,
// its place among the objects written and the object, its place alone where it is
// left out, `{}` for a step that is no command, or null where every one is taken.
function objectNotTaken(step, commands) {
  if (!isCallStep(step) || !commands.has(step.get('name').name)) return {};
  const { taken, optional } = commands.get(step.get('name').name);
  const objects = step.get('modifiers') ?? [];
  const rules = [...taken, ...optional];
  const index = rules.findIndex((rule, at) => (at < objects.length ? !rule(objects[at]) : at < taken.length));
  if (index !== -1) return { index, actualValue: objects[index] };
  return objects.length > rules.length ? { index: rules.length, actualValue: objects[rules.length] } : null;
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
    if (head !== ANSWER_NAME && head !== SUBJECT_NAME && !chain.inputs.some(input => input.name.name === head)) throw new FnNameUnderNoInputError({ name: keyword(name), actualValue: quote });
  };
  for (const step of quote) {
    const refused = objectNotTaken(step, COMMANDS);
    if (refused !== null) throw new FnCommandNotTakenError({ command: makeQuote([step]), ...refused });
    const [first, second, third, fourth] = step.get('modifiers');
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
    const refused = objectNotTaken(step, KIND_COMMANDS);
    if (refused !== null) throw new KindCommandNotTakenError({ command: makeQuote([step]), ...refused });
    const [first, second, third, fourth] = step.get('modifiers');
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

// invariantsOf(chain, name) → the invariants written under the subject, an
// input or the answer, in their order.
export function invariantsOf(chain, name) {
  return chain.invariants.filter(invariant => invariant.name.startsWith(`${name}/`));
}

// The places the inputs of a function read, one past the greatest index an
// input reads strictly or softly, or null when one reads no index, the args
// whole, a place counted from its end, code of several steps or anything
// else, and so takes any number of values [QSBLD#input].
function placesOfReadings(readings) {
  let places = 0;
  for (const { index, ofSeveralSteps } of readings) {
    if (!Number.isInteger(index) || ofSeveralSteps) return null;
    places = Math.max(places, index + 1);
  }
  return places;
}

// How the place of an input of a function reads the args, once per place
// [QSBLD#input]: the path it reads, a quote of a path alone among them, or
// else the quote it runs, the index of the arg its first step reads, whether
// the place is that one step, and whether it reads the args whole, `~(it)`.
const READINGS = new WeakMap();

function readingOfPlace(value) {
  let reading = READINGS.get(value);
  if (reading === undefined) {
    const path = isPath(value) ? value : isPathAlone(value) ? value[0] : null;
    const steps = path === null ? value : [path];
    const head = steps[0];
    const call = isCallStep(head) ? { name: head.get('name').name, modifiers: head.get('modifiers') ?? [] } : null;
    const index = indexReadBy(head, call);
    const onePlace = steps.length === 1 && Number.isInteger(index) && (path === null ? call.modifiers.length <= 2 : path.segments.length === 1);
    reading = {
      path, place: value, index, onePlace,
      ofSeveralSteps: steps.length > 1,
      strict: onePlace && path !== null,
      fallback: call?.modifiers.length === 2 ? call.modifiers[1] : null,
      readsArgs: steps.length === 1 && call?.name === 'it' && call.modifiers.length === 0
    };
    READINGS.set(value, reading);
  }
  return reading;
}

// The index of the arg the first step of a place reads, by a path or by
// `query`, a whole number, or none for a place that reads the args whole,
// one counted from its end or anything else.
function indexReadBy(head, call) {
  const read = isPath(head) ? head : call?.name === 'query' && isPath(call.modifiers[0]) && call.modifiers[0].segments.length === 1 ? call.modifiers[0] : null;
  const index = read === null ? NaN : segmentIndex(read.segments[0]);
  return Number.isInteger(index) && index >= 0 ? index : NaN;
}

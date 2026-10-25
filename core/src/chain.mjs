// [QSBLD#fn], [QSBLD#kind]

import { declareRefusal } from './errors.mjs';
import { readsAsBareKeyword, readsAsName } from './name-chars.mjs';
import {
  isDoc, isKeyword, isPath, isSet, isQuote, isTag, makeDoc, makeKeyword, makePath, makeQuote, makeTag, makeTagged, commandsOf,
  FN_TAG_NAME, KIND_TAG_NAME, BUILTIN_TAG, ERROR_TAG, TRACE_TAG, CORE_KIND, TAG_HEADER_SYMBOL
} from './types.mjs';
import { isCallStep, isPathAlone, builtFrom, commandStep } from './steps.mjs';
import { makeSet } from './ordering.mjs';
import { ANY_KIND_NAME, elementsRefusalAddress, kindsRefusalAddress, notGivenAddress, notReadAddress, payloadRefusalName } from './address.mjs';
import { readPath, segmentIndex, MISSED } from './path-read.mjs';

const FnCommandNotTakenError = declareRefusal('fn/CommandNotTakenError');
const FnNameDeclaredTwiceError = declareRefusal('fn/NameDeclaredTwiceError');
const FnNameUnderNoInputError = declareRefusal('fn/NameUnderNoInputError');
const FnLawUnderNoNameError = declareRefusal('fn/LawUnderNoNameError');
const KindCommandNotTakenError = declareRefusal('kind/CommandNotTakenError');
const KindNameDeclaredTwiceError = declareRefusal('kind/NameDeclaredTwiceError');
const KindNameUnderNoFieldError = declareRefusal('kind/NameUnderNoFieldError');
const KindLawUnderNoNameError = declareRefusal('kind/LawUnderNoNameError');

export const ANSWER_NAME = 'answer';
export const SUBJECT_NAME = 'subject';
export const PAYLOAD_NAME = 'payload';

const isNameOfChain = value => isKeyword(value) && readsAsBareKeyword(value.name);
const isNameOfOneSegment = value => isKeyword(value) && readsAsName(value.name);
const isInputName = value => isNameOfOneSegment(value) && value.name !== ANSWER_NAME && value.name !== SUBJECT_NAME;
const isFieldName = value => isNameOfOneSegment(value) && value.name !== PAYLOAD_NAME;
const isSelector = value => isPath(value) || isQuote(value);
const isKinds = value => isTag(value) || (isSet(value) && value.length > 0 && value.every(isTag));
const isPlainVec = value => Array.isArray(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isKindsOfEach = value => isKinds(value) || (isPlainVec(value) && value.length === 1 && isKinds(value[0]));
const isKindsOfAPayload = value => isKindsOfEach(value) || (isSet(value) && value.length === 0);
const isSelectorOrKinds = value => isSelector(value) || isKindsOfEach(value);

const COMMANDS = new Map([
  ['on', { taken: [isDoc], optional: [isKinds] }],
  ['takes', { taken: [isInputName, isDoc, isSelector], optional: [isKindsOfEach] }],
  ['returns', { taken: [isDoc, isKinds], optional: [] }],
  ['throws', { taken: [isNameOfChain, isDoc], optional: [isQuote] }],
  ['holds', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }],
  ['proves', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }]
]);

const KIND_COMMANDS = new Map([
  ['accepts', { taken: [isDoc], optional: [isKindsOfAPayload] }],
  ['wires', { taken: [isFieldName, isDoc], optional: [isSelectorOrKinds, isKindsOfEach] }],
  ['tells', { taken: [isFieldName, isDoc], optional: [isKinds] }],
  ['holds', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }],
  ['throws', { taken: [isNameOfChain, isDoc], optional: [isQuote] }],
  ['proves', { taken: [isNameOfChain, isDoc, isQuote], optional: [] }]
]);

export const FN_COMMAND_NAMES = Object.freeze([...COMMANDS.keys()]);
export const KIND_COMMAND_NAMES = Object.freeze([...KIND_COMMANDS.keys()]);
export const COMMAND_NAMES = Object.freeze([...new Set([...FN_COMMAND_NAMES, ...KIND_COMMAND_NAMES, 'impl'])]);

// [QSNAM#address], [QSLSP#server]
export function isVerbBody(body) {
  return isQuote(body) || [FN_TAG_NAME, BUILTIN_TAG.name].includes(builtFrom(body));
}

function modifierNotTaken(step, commands) {
  if (!isCallStep(step) || !commands.has(step.get('name').name)) return {};
  const { taken, optional } = commands.get(step.get('name').name);
  const modifiers = step.get('modifiers') ?? [];
  const rules = [...taken, ...optional];
  const index = rules.findIndex((rule, at) => (at < modifiers.length ? !rule(modifiers[at]) : at < taken.length));
  if (index !== -1) return { index, actualValue: modifiers[index] };
  return modifiers.length > rules.length ? { index: rules.length, actualValue: modifiers[rules.length] } : null;
}

function kindsOf(value) {
  if (value === undefined) return null;
  const names = isTag(value) ? [value.name] : value.map(tag => tag.name);
  return names.includes(ANY_KIND_NAME) ? null : names;
}

function kindsWritten(written) {
  const each = isPlainVec(written);
  return { each, kinds: kindsOf(each ? written[0] : written), written: written ?? null };
}

function namesOf(quote, DeclaredTwiceError) {
  const declared = new Set();
  const named = new Set();
  return {
    named,
    declare(name) {
      if (declared.has(name)) throw new DeclaredTwiceError({ name: makeKeyword(name), actualValue: quote });
      declared.add(name);
      named.add(name);
    },
    isUnderANamed: name => named.has(name.slice(0, name.lastIndexOf('/')))
  };
}

function readChainOfFn(quote) {
  const chain = { subject: null, inputs: [], answer: null, pages: new Map(), refusalKinds: new Map(), invariants: [], laws: [] };
  const names = namesOf(quote, FnNameDeclaredTwiceError);
  const underAnInput = name => {
    const [head] = name.split('/');
    if (head !== ANSWER_NAME && head !== SUBJECT_NAME && !chain.inputs.some(input => input.name.name === head)) throw new FnNameUnderNoInputError({ name: makeKeyword(name), actualValue: quote });
  };
  for (const step of quote) {
    const refused = modifierNotTaken(step, COMMANDS);
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
        chain.inputs.push({ name: first, page: second, selector: third, kinds, each, written, reading: readingOfSelector(third) });
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
        if (third !== undefined) chain.refusalKinds.set(first.name, kindOfARefusalWritten(third));
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
  chain.arity = arityOfReadings(chain.inputs.map(input => input.reading));
  return Object.freeze(chain);
}

function readChainOfKind(quote) {
  const kind = { payload: null, fields: [], tells: [], pages: new Map(), refusalKinds: new Map(), invariants: [], laws: [] };
  const names = namesOf(quote, KindNameDeclaredTwiceError);
  const underAField = name => {
    const [head] = name.split('/');
    if (!kind.fields.some(field => field.name.name === head)) throw new KindNameUnderNoFieldError({ name: makeKeyword(name), actualValue: quote });
    return head;
  };
  for (const step of quote) {
    const refused = modifierNotTaken(step, KIND_COMMANDS);
    if (refused !== null) throw new KindCommandNotTakenError({ command: makeQuote([step]), ...refused });
    const [first, second, third, fourth] = step.get('modifiers');
    switch (step.get('name').name) {
      case 'accepts': {
        names.declare(PAYLOAD_NAME);
        const { each, kinds, written } = kindsWritten(second);
        if (kinds !== null) names.named.add(payloadRefusalName(each));
        if (each) names.named.add(payloadRefusalName(false));
        kind.payload = { page: first, kinds, each, written };
        break;
      }
      case 'wires': {
        if (!isSelector(third) && fourth !== undefined) throw new KindCommandNotTakenError({ command: makeQuote([step]), index: 3, actualValue: fourth });
        names.declare(first.name);
        const selector = isSelector(third) ? third : makePath([first.name]);
        const { each, kinds, written } = kindsWritten(isSelector(third) ? fourth : third);
        names.named.add(notGivenAddress(first.name));
        names.named.add(notReadAddress(first.name));
        if (each) names.named.add(kindsRefusalAddress(first.name));
        if (kinds !== null) names.named.add((each ? elementsRefusalAddress : kindsRefusalAddress)(first.name));
        kind.fields.push({ name: first, page: second, selector, place: placeOf(selector), kinds, each, written });
        break;
      }
      case 'tells':
        names.declare(first.name);
        kind.tells.push({ name: first.name, page: second, written: third ?? null });
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
        if (third !== undefined) kind.refusalKinds.set(first.name, kindOfARefusalWritten(third));
        break;
      default:
        if (first.name.includes('/') && !names.isUnderANamed(first.name)) throw new KindLawUnderNoNameError({ name: first, actualValue: quote });
        names.declare(first.name);
        kind.laws.push({ name: first.name, page: second, query: third });
    }
  }
  kind.wired = new Map(kind.fields.map(field => [field.name.name, field]));
  return Object.freeze(kind);
}

const CHAINS_OF_FUNCTIONS = new WeakMap();

export function chainOfFn(fn) {
  let chain = CHAINS_OF_FUNCTIONS.get(fn);
  if (chain === undefined) CHAINS_OF_FUNCTIONS.set(fn, chain = readChainOfFn(commandsOf(fn)));
  return chain;
}

// [QSBLD#recipe]
const FUNCTIONS_OF_RECIPES = new WeakMap();
const NO_COMMANDS = makeQuote([]);

export function functionOfRecipe(recipe) {
  let fn = FUNCTIONS_OF_RECIPES.get(recipe);
  if (fn === undefined) FUNCTIONS_OF_RECIPES.set(recipe, fn = makeTagged(makeTag(FN_TAG_NAME), Object.freeze([NO_COMMANDS, recipe])));
  return fn;
}

const CHAINS_OF_KINDS = new WeakMap();

export function chainOfKind(kind) {
  let chain = CHAINS_OF_KINDS.get(kind);
  if (chain === undefined) CHAINS_OF_KINDS.set(kind, chain = readChainOfKind(commandsOf(kind)));
  return chain;
}

// [QSHST#source]
export function wiringAtPlaces(kind) {
  const { fields } = chainOfKind(kind);
  if (fields.length === 0 || fields.some(({ place }) => place === null)) return null;
  return payload => new Map(fields.map(({ name, place: { path, soft } }) => {
    const part = readPath(payload, path, soft);
    return [name.name, part === MISSED ? null : part];
  }));
}

// [QSBLD#value]
function placeOf(selector) {
  if (isPath(selector) || isPathAlone(selector)) return { path: isPath(selector) ? selector : selector[0], soft: false };
  const [step] = selector;
  const modifiers = isCallStep(step) ? step.get('modifiers') ?? [] : [];
  if (selector.length !== 1 || modifiers.length !== 1 || !isPath(modifiers[0])) return null;
  const name = step.get('name').name;
  return name === 'get' || name === 'query' ? { path: modifiers[0], soft: name === 'query' } : null;
}

// [QSBLD#fn], [QSERR#rest]
const KIND_TAG = makeTag(KIND_TAG_NAME);
const pageLinkingTo = tag => makeDoc([makeTagged(makeTag('link'), makeQuote([tag, commandStep('doc', [])]))]);
const ACCEPTS_THE_ERROR = commandStep('accepts', [pageLinkingTo(ERROR_TAG), ERROR_TAG]);
const WIRES_THE_TRACE = commandStep('wires', [
  makeKeyword('trace'), pageLinkingTo(TRACE_TAG), makeQuote([commandStep('query', [makePath(['trace'])])]), makeSet([CORE_KIND.null, TRACE_TAG])
]);
const finishedOver = commands => makeTagged(KIND_TAG, Object.freeze([makeQuote([ACCEPTS_THE_ERROR, ...commands, WIRES_THE_TRACE]), null]));
const KIND_OF_A_PAGE_ALONE = finishedOver([]);
const FINISHED_KINDS = new WeakMap();

export function kindThrowsFinishes(kind) {
  if (kind === null) return KIND_OF_A_PAGE_ALONE;
  let finished = FINISHED_KINDS.get(kind);
  if (finished === undefined) FINISHED_KINDS.set(kind, finished = finishedOver(commandsOf(kind)));
  return finished;
}

function kindOfARefusalWritten(commands) {
  const kind = makeTagged(KIND_TAG, Object.freeze([commands, null]));
  chainOfKind(kindThrowsFinishes(kind));
  return kind;
}

// [QSBLD#recipe]
export function invariantsOf(chain, name) {
  return chain.invariants.filter(invariant => invariant.name.startsWith(`${name}/`));
}

// [QSBLD#input]
function arityOfReadings(readings) {
  let arity = 0;
  for (const { index, ofSeveralSteps } of readings) {
    if (!Number.isInteger(index) || ofSeveralSteps) return null;
    arity = Math.max(arity, index + 1);
  }
  return arity;
}

const READINGS = new WeakMap();

function readingOfSelector(value) {
  let reading = READINGS.get(value);
  if (reading === undefined) {
    const path = isPath(value) ? value : isPathAlone(value) ? value[0] : null;
    const steps = path === null ? value : [path];
    const head = steps[0];
    const call = isCallStep(head) ? { name: head.get('name').name, modifiers: head.get('modifiers') ?? [] } : null;
    const index = indexReadBy(head, call);
    const oneArg = steps.length === 1 && Number.isInteger(index) && (path === null ? call.modifiers.length <= 2 : path.segments.length === 1);
    reading = {
      path, selector: value, index, oneArg,
      ofSeveralSteps: steps.length > 1,
      strict: oneArg && path !== null,
      fallback: call?.modifiers.length === 2 ? call.modifiers[1] : null,
      readsArgs: steps.length === 1 && call?.name === 'it' && call.modifiers.length === 0
    };
    READINGS.set(value, reading);
  }
  return reading;
}

function indexReadBy(head, call) {
  const read = isPath(head) ? head : call?.name === 'query' && isPath(call.modifiers[0]) && call.modifiers[0].segments.length === 1 ? call.modifiers[0] : null;
  const index = read === null ? NaN : segmentIndex(read.segments[0]);
  return Number.isInteger(index) && index >= 0 ? index : NaN;
}

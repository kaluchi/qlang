// The records of the steps of code, each under its tag, any other step a
// literal standing as itself, and the rules their constructors hold, which a
// quote assembled from data and the parser reading a text both go through,
// a refusal of a rule writing the parts it names as `written` writes them [QSQUO#step].

import { readsAsBareKeyword, LITERAL_WORDS } from './name-chars.mjs';
import { declareRefusal } from './errors.mjs';
import { kindsExpected, makeSet } from './ordering.mjs';
import {
  keyword, isKeyword, isTag, isRegex, isPath, isDoc, isQuote, isVec, isMap, isSet, isTagged, isValueClass,
  makeTag, makeTagged, makeQuote, errorAtRest, payloadBeneath, holdsNoOtherTag, ERROR_TAG, QUOTE_TAG, TAG_HEADER_SYMBOL
} from './types.mjs';

const CALL_TAG      = makeTag('call');
const BIND_TAG      = makeTag('bind');
const CONSTRUCT_TAG = makeTag('construct');
export const FAIL_TAG = makeTag('fail');
const GROUP_TAG     = makeTag('group');

const tagNameOf = value => value?.[TAG_HEADER_SYMBOL]?.name;
const recordUnder = tag => value => isMap(value) && tagNameOf(value) === tag.name;
const quoteUnder = tag => value => isValueClass(value, 'underTag') && value.tag.name === tag.name && isQuote(value.payload);

export const isCallStep = recordUnder(CALL_TAG);
export const isBindStep = recordUnder(BIND_TAG);
export const isConstructStep = recordUnder(CONSTRUCT_TAG);
export const isFailStep = quoteUnder(FAIL_TAG);
export const isGroupStep = quoteUnder(GROUP_TAG);

const isBareVec = value => isVec(value) && tagNameOf(value) === undefined;
const isBareMap = value => isMap(value) && tagNameOf(value) === undefined;
const isAtom = value => value === null || ['boolean', 'number', 'string'].includes(typeof value)
  || isKeyword(value) || isTag(value) || isRegex(value) || isPath(value);

// The quote of a path alone, which its text refuses and a step writes bare [QSSYN#step].
export const isPathAlone = quote => quote.length === 1 && isPath(quote[0]);

// isOfTheKindOfErrors(value) — whether a value is the error `!{…}` writes, the
// map of its facts under `::error` alone, a tag written before it the tag of
// its error, `::E::error!{…}` the step `::E!{…}` is [QSERR#rest], [QSQUO#step].
export const isOfTheKindOfErrors = value => isMap(value) && tagNameOf(value) === ERROR_TAG.name;

// The fields of the step of an error literal, a map under `::error` beneath
// the tag the literal writes before its bang [QSERR#rest]; null for any
// other value.
export function errorFieldsOf(value) {
  const fields = isValueClass(value, 'underTag') ? value.payload : value;
  return isOfTheKindOfErrors(fields) ? fields : null;
}

// computes(step) — a step that computes, which no literal holds [QSLIT#closed].
export const computes = value => isCallStep(value) || isGroupStep(value);

const isPartOfALiteral = value => isLiteral(value) || isConstructStep(value) || computes(value);

// The parts of a container literal, the facts of an error literal and the
// elements of a set, a vector and a map, or null for any other value [QSQUO#step].
function partsOfAContainer(value) {
  const fields = errorFieldsOf(value);
  if (fields !== null) return [...fields.values()];
  if (isSet(value) || isBareVec(value)) return value;
  return isBareMap(value) ? [...value.values()] : null;
}

// isLiteral(step) — a step that is no record: an atom, a quote, a doc and an
// error literal, a set, a vector or a map of the parts of a literal, walked by
// a stack of its own [QSQUO#step].
export function isLiteral(value) {
  const pending = [value];
  while (pending.length > 0) {
    const part = pending.pop();
    if (isAtom(part) || (isQuote(part) && !isPathAlone(part)) || isDoc(part)) continue;
    const parts = partsOfAContainer(part);
    if (parts === null) return false;
    for (const held of parts) if (!isConstructStep(held) && !computes(held)) pending.push(held);
  }
  return true;
}

// Every element of a quote is a step, a record or a literal [QSQUO#step].
const isStep = value => isCallStep(value) || isBindStep(value) || isConstructStep(value)
  || isFailStep(value) || isGroupStep(value) || isLiteral(value);

// A command, what a later step of the success track is [QSSYN#step].
export const standsAsCommand = step => isCallStep(step) || isBindStep(step) || isGroupStep(step);

// Whether a step declares a name, itself or after `!|` [QSNAM#scope].
export const declaresAName = step => isBindStep(step) || (isFailStep(step) && isBindStep(step.payload[0]));

// holdsALiteral(step) — a literal step, a literal or a tagged literal [QSQUO#step].
export const holdsALiteral = step => isLiteral(step) || isConstructStep(step);

// partsOfALiteral(value) → the parts a part that computes is searched among:
// the payload of a tagged literal and the parts of a container, none of a
// quote, which holds code, or of a doc, whose segments compute nothing
// [QSLIT#closed], [QSQUO#step].
export function partsOfALiteral(value) {
  return isConstructStep(value) ? [value.get('payload')] : partsOfAContainer(value) ?? [];
}

// Whether a literal or a part of it at any depth answers the test, walked by
// a stack of its own [QSLIT#closed], [QSQUO#step].
function holdsWithin(value, test) {
  const pending = [value];
  while (pending.length > 0) {
    const part = pending.pop();
    if (test(part)) return true;
    for (const held of partsOfALiteral(part)) pending.push(held);
  }
  return false;
}

export const computesWithin = value => holdsWithin(value, computes);

function literalMessage(literal, written) {
  const template = written.quoting(literal);
  if (errorFieldsOf(literal) === null) return `a literal computes nothing: a shape computed is built by \`get\`, its parts paths and quotes, write \`get ${template}\``;
  const tagged = isValueClass(literal, 'underTag') ? ` | tag ${literal.tag.literal}` : '';
  return `an error literal computes nothing: facts computed are built by \`get\` and \`raise\` makes them an error, write \`get ${template.slice(template.indexOf('!') + 1)}${tagged} | raise\``;
}

// A literal holds no part that computes, as `written` reads its parts, the
// value refused the literal where the facts name none.
function heldAsALiteral(literal, Refusal, facts, written) {
  if (written.computesWithin(literal)) throw new Refusal({ actualValue: literal, ...facts, message: literalMessage(literal, written) });
}

function laterStepMessage(step, written) {
  if (isPath(step)) return `a path is a value, which the verb that takes it reads: write \`get ${written.of(step)}\``;
  if (isTag(step)) return `a tag goes over the value in the pipe by \`tag\`: write \`tag ${written.of(step)}\``;
  if (isQuote(step)) return 'code runs on the value in the pipe by `apply`: write `apply ~(…)`';
  if (isSet(step) || isBareVec(step) || isBareMap(step) || isConstructStep(step)) return 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`';
  return 'a step is a command: a value stands at the head, where it is the subject, or as what a verb takes';
}

function nameMessage(name, written) {
  return readsAsBareKeyword(name.name)
    ? `\`${written.of(name)}\` is the word of a literal, which a step reads as the value: declare another name`
    : `\`${written.of(name)}\` names nothing a step can call: a name begins with a letter or \`_\`, \`:first_name 5\``;
}

const QuotePayloadKindNotTakenError = declareRefusal('quote/PayloadKindNotTakenError');
const QuoteElementNotStepError = declareRefusal('quote/ElementNotStepError');
const QuoteStepNotCommandError = declareRefusal('quote/StepNotCommandError');
const QuoteLiteralComputesError = declareRefusal('quote/LiteralComputesError');
const CallPayloadKindNotTakenError = declareRefusal('call/PayloadKindNotTakenError');
const CallPayloadNotSchemaError = declareRefusal('call/PayloadNotSchemaError');
const CallNameNotCallableError = declareRefusal('call/NameNotCallableError');
const CallLiteralComputesError = declareRefusal('call/LiteralComputesError');
const BindPayloadKindNotTakenError = declareRefusal('bind/PayloadKindNotTakenError');
const BindPayloadNotSchemaError = declareRefusal('bind/PayloadNotSchemaError');
const BindNameNotCallableError = declareRefusal('bind/NameNotCallableError');
const BindLiteralComputesError = declareRefusal('bind/LiteralComputesError');
const ConstructPayloadKindNotTakenError = declareRefusal('construct/PayloadKindNotTakenError');
const ConstructPayloadNotSchemaError = declareRefusal('construct/PayloadNotSchemaError');
const ConstructLiteralComputesError = declareRefusal('construct/LiteralComputesError');
const FailPayloadKindNotTakenError = declareRefusal('fail/PayloadKindNotTakenError');
const FailPayloadNotOneStepError = declareRefusal('fail/PayloadNotOneStepError');
const FailStepNotCommandError = declareRefusal('fail/StepNotCommandError');
const GroupPayloadKindNotTakenError = declareRefusal('group/PayloadKindNotTakenError');
const GroupPayloadEmptyError = declareRefusal('group/PayloadEmptyError');

const isWord = value => holdsALiteral(value) || isGroupStep(value) || (isCallStep(value) && !value.has('modifiers'));
const isBody = value => (holdsALiteral(value) && !isDoc(value)) || isGroupStep(value) || isCallStep(value);
const isTaggedPayload = value => isPartOfALiteral(value) && !isOfTheKindOfErrors(value);
const vecOfOneAtLeast = isElement => value => isBareVec(value) && value.length > 0 && value.every(isElement);

// The schema of each record, the rule each field holds and the fields it requires.
const CALL = {
  tag: CALL_TAG, PayloadKindNotTakenError: CallPayloadKindNotTakenError, PayloadNotSchemaError: CallPayloadNotSchemaError,
  fields: { name: isKeyword, modifiers: vecOfOneAtLeast(isWord) }, required: ['name']
};
const BIND = {
  tag: BIND_TAG, PayloadKindNotTakenError: BindPayloadKindNotTakenError, PayloadNotSchemaError: BindPayloadNotSchemaError,
  fields: { name: isKeyword, docs: vecOfOneAtLeast(isDoc), body: isBody }, required: ['name']
};
const CONSTRUCT = {
  tag: CONSTRUCT_TAG, PayloadKindNotTakenError: ConstructPayloadKindNotTakenError, PayloadNotSchemaError: ConstructPayloadNotSchemaError,
  fields: { tag: isTag, payload: isTaggedPayload }, required: ['tag', 'payload']
};

// The record a map writes, a payload of another kind refused by the role of
// the holder and a field that breaks its record by its name [QSQUO#step].
function recordFrom(payload, record) {
  if (!isMap(payload) || !holdsNoOtherTag(payload, record.tag.name)) throw new record.PayloadKindNotTakenError({ expected: kindsExpected('map'), actualValue: payload });
  for (const name of record.required) if (!payload.has(name)) throw new record.PayloadNotSchemaError({ field: keyword(name), actualValue: null });
  for (const [name, value] of payload) {
    if (!Object.hasOwn(record.fields, name) || !record.fields[name](value)) throw new record.PayloadNotSchemaError({ field: keyword(name), actualValue: value });
  }
  return makeTagged(record.tag, new Map(payload));
}

// `::call`, a command: its name one a step calls, its modifiers words, a
// literal among them computing nothing [QSQUO#step], [QSNAM#letters].
export function callOf(payload, written) {
  const call = recordFrom(payload, CALL);
  const name = call.get('name');
  if (!readsAsBareKeyword(name.name) || LITERAL_WORDS.has(name.name.split('/')[0])) throw new CallNameNotCallableError({ name, message: nameMessage(name, written) });
  (call.get('modifiers') ?? []).forEach((modifier, index) => {
    if (holdsALiteral(modifier)) heldAsALiteral(modifier, CallLiteralComputesError, { index }, written);
  });
  return call;
}

// `::bind`, a declaration: its name, its docs and its body, a body or a page
// at least, the name one a step calls and the body no doc, which reads as
// the page, a literal body computing nothing [QSQUO#step], [QSNAM#letters].
export function bindOf(payload, written) {
  const bind = recordFrom(payload, BIND);
  if (!bind.has('docs') && !bind.has('body')) throw new BindPayloadNotSchemaError({ field: keyword('body'), actualValue: null });
  const name = bind.get('name');
  if (!readsAsBareKeyword(name.name) || (!declaresKind(bind) && LITERAL_WORDS.has(name.name))) throw new BindNameNotCallableError({ name, message: nameMessage(name, written) });
  if (holdsALiteral(bind.get('body'))) heldAsALiteral(bind.get('body'), BindLiteralComputesError, {}, written);
  return bind;
}

// `::construct`, a tagged literal: its tag and its payload, no error literal,
// which the tag before its bang writes [QSQUO#step]; the parser's literal is
// held to the rule of a literal whole by the step that holds it [QSLIT#closed].
export function constructOf(payload) {
  return recordFrom(payload, CONSTRUCT);
}

// `::construct` assembled from data holds its payload a literal that computes
// nothing, refused as the map its record is built from [QSLIT#closed], [QSQUO#step].
export function constructOfData(payload, written) {
  const construct = constructOf(payload);
  heldAsALiteral(construct, ConstructLiteralComputesError, { actualValue: payload }, written);
  return construct;
}

// `::fail`, the step `!|` runs: the quote of one step, no step of the fail track, no
// path, no quote and no literal that holds either [QSQUO#step], [QSSYN#step].
export function failOf(payload, written) {
  if (!isQuote(payload)) throw new FailPayloadKindNotTakenError({ expected: kindsExpected('quote'), actualValue: payload });
  if (payload.length !== 1 || isFailStep(payload[0])) throw new FailPayloadNotOneStepError({ actualValue: payload });
  const [step] = payload;
  if (isPath(step) || isQuote(step)) throw new FailStepNotCommandError({ message: laterStepMessage(step, written), actualValue: step });
  if (partsOfALiteral(step).some(part => holdsWithin(part, held => isPath(held) || isQuote(held)))) {
    throw new FailStepNotCommandError({ message: `a literal that holds a path or a quote is the template \`get\` reads: write \`get ${written.quoting(step)}\``, actualValue: step });
  }
  return makeTagged(FAIL_TAG, payload);
}

// `::group`, steps in parentheses: the quote of a step at least [QSQUO#step].
export function groupOf(payload) {
  if (!isQuote(payload)) throw new GroupPayloadKindNotTakenError({ expected: kindsExpected('quote'), actualValue: payload });
  if (payload.length === 0) throw new GroupPayloadEmptyError({ actualValue: payload });
  return makeTagged(GROUP_TAG, payload);
}

// `::quote`, a vector of steps: a literal of them computing nothing, and a
// value after the head of the success track refused but after a
// declaration, by the message of its kind [QSQUO#step], [QSSYN#step].
export function quoteOf(payload, written) {
  if (!isVec(payload) || !holdsNoOtherTag(payload, QUOTE_TAG.name)) throw new QuotePayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  payload.forEach((element, index) => {
    if (!isStep(element)) throw new QuoteElementNotStepError({ index, actualValue: element });
  });
  payload.forEach((step, index) => {
    if (holdsALiteral(step)) heldAsALiteral(step, QuoteLiteralComputesError, { index }, written);
  });
  payload.forEach((step, index) => {
    if (index > 0 && !standsAsCommand(step) && !isFailStep(step) && !declaresAName(payload[index - 1])) {
      throw new QuoteStepNotCommandError({ index, message: laterStepMessage(step, written), actualValue: step });
    }
  });
  return makeQuote(payload);
}

// The noun a body builds its value from as it is written: the tag of its
// tagged literal, `::fn[…]`, or the tag at the head of its chain of commands,
// `::kind | wraps …`, in a group or not; null for any other body
// [QSBLD#fn], [QSBLD#kind].
export function builtFrom(body) {
  if (isConstructStep(body)) return body.get('tag').name;
  if (!isGroupStep(body)) return null;
  const [head, ...rest] = body.payload;
  if (rest.length === 0) return isConstructStep(head) ? head.get('tag').name : null;
  return isTag(head) ? head.name : null;
}

// declaresKind(bind) — whether a declaration declares a label, by its page
// alone or by the chain of a kind [QSBLD#kind].
export const declaresKind = bind => !bind.has('body') || builtFrom(bind.get('body')) === 'kind';

// The runtime's own steps, which keep the rules by how they are made.
export function commandStep(name, modifiers) {
  return makeTagged(CALL_TAG, new Map([['name', keyword(name)], ['modifiers', Object.freeze([...modifiers])]]));
}

// tagCallStepOf(tag) → the step `tag ::Tag`, the call a tagged literal
// stands for [QSERR#trace].
export const tagCallStepOf = tag => commandStep('tag', [tag]);

export const groupStep = steps => makeTagged(GROUP_TAG, makeQuote(steps));

// The step that answers a value where it stands: a literal as itself, a
// container of the steps of its parts and a value under a tag the tagged
// literal of its payload [QSQUO#step].
function stepOfValue(value) {
  const fields = errorFieldsOf(value);
  if (fields !== null) return errorAtRest(isValueClass(value, 'underTag') ? value.tag : ERROR_TAG, new Map([...fields].map(([key, fact]) => [key, stepOfValue(fact)])));
  if (isSet(value)) return makeSet(value.map(stepOfValue));
  if (isQuote(value) && isPathAlone(value)) return constructOf(new Map([['tag', QUOTE_TAG], ['payload', Object.freeze([value[0]])]]));
  if (isQuote(value) || isDoc(value)) return value;
  if (isTagged(value)) return constructOf(new Map([['tag', value[TAG_HEADER_SYMBOL]], ['payload', stepOfValue(payloadBeneath(value))]]));
  if (isVec(value)) return Object.freeze(value.map(stepOfValue));
  return isMap(value) ? new Map([...value].map(([key, part]) => [key, stepOfValue(part)])) : value;
}

// declarationStep(name, docs, value) → the step of a declaration that binds
// a value under its docs, a doc in a group, since a doc after the name is a
// page of the declaration.
export function declarationStep(name, docs, value) {
  const body = isDoc(value) ? groupStep([value]) : stepOfValue(value);
  return makeTagged(BIND_TAG, new Map([['name', keyword(name)], ['docs', Object.freeze([...docs])], ['body', body]]));
}

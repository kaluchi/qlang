// [QSQUO#step]

import { readsAsBareKeyword, LITERAL_WORDS } from './name-chars.mjs';
import { declareRefusal } from './errors.mjs';
import { makeSet } from './ordering.mjs';
import {
  makeKeyword, isKeyword, isTag, isRegex, isPath, isDoc, isQuote, isVec, isMap, isSet, isTagged, isValueClass,
  makeTag, makeTagged, makeQuote, errorAtRest, payloadBeneath, canonicalKeywordLiteral, ERROR_TAG, QUOTE_TAG, TAG_HEADER_SYMBOL
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

// [QSSYN#step]
export const isPathAlone = quote => quote.length === 1 && isPath(quote[0]);

// [QSERR#rest]
export const isOfTheKindOfErrors = value => isMap(value) && tagNameOf(value) === ERROR_TAG.name;

export const errorFieldsOf = value => (isOfTheKindOfErrors(value) ? value : null);

// [QSLIT#closed]
export const isComputingStep = value => isCallStep(value) || isGroupStep(value);

const isPartOfALiteral = value => isLiteral(value) || isConstructStep(value) || isComputingStep(value);

// [QSQUO#step]
function partsOfAContainer(value) {
  const fields = errorFieldsOf(value);
  if (fields !== null) return [...fields.values()];
  if (isSet(value) || isBareVec(value)) return value;
  return isBareMap(value) ? [...value.values()] : null;
}

export function isLiteral(value) {
  const pending = [value];
  while (pending.length > 0) {
    const part = pending.pop();
    if (isAtom(part) || (isQuote(part) && !isPathAlone(part)) || isDoc(part)) continue;
    const parts = partsOfAContainer(part);
    if (parts === null) return false;
    for (const held of parts) if (!isConstructStep(held) && !isComputingStep(held)) pending.push(held);
  }
  return true;
}

const isStep = value => isCallStep(value) || isBindStep(value) || isConstructStep(value)
  || isFailStep(value) || isGroupStep(value) || isLiteral(value);

// [QSSYN#step]
export const standsAsCommand = step => isCallStep(step) || isBindStep(step) || isGroupStep(step);

// [QSNAM#scope]
export const declaresAName = step => isBindStep(step) || (isFailStep(step) && isBindStep(step.payload[0]));

// [QSQUO#step]
export const holdsALiteral = step => isLiteral(step) || isConstructStep(step);

// [QSLIT#closed], [QSQUO#step]
export function partsOfALiteral(value) {
  return isConstructStep(value) ? [value.get('payload')] : partsOfAContainer(value) ?? [];
}

function holdsWithin(value, test) {
  const pending = [value];
  while (pending.length > 0) {
    const part = pending.pop();
    if (test(part)) return true;
    for (const held of partsOfALiteral(part)) pending.push(held);
  }
  return false;
}

export const computesWithin = value => holdsWithin(value, isComputingStep);

// [QSLIT#closed]
const TEMPLATE_WITHIN = 80;

function templateOf(literal, written) {
  const whole = written.quoting(literal);
  return Array.from(whole).length <= TEMPLATE_WITHIN ? whole : templateCut(literal, written);
}

function templateCut(literal, written) {
  if (isComputingStep(literal)) return written.quoting(literal);
  if (!computesWithin(literal)) return '…';
  if (isConstructStep(literal)) return `${literal.get('tag').literal}${templateCut(literal.get('payload'), written)}`;
  const fields = errorFieldsOf(literal);
  if (fields !== null) return `!{${entriesCut(fields, written)}}`;
  if (isBareMap(literal)) return `{${entriesCut(literal, written)}}`;
  return `${isSet(literal) ? '#[' : '['}${runsCut(literal.map(part => templateCut(part, written)))}]`;
}

const entriesCut = (entries, written) => runsCut([...entries].map(([key, part]) => (computesWithin(part) ? `${canonicalKeywordLiteral(key)} ${templateCut(part, written)}` : '…')));

const runsCut = pieces => pieces.filter((piece, at) => piece !== '…' || pieces[at - 1] !== '…').join(' ');

function literalMessage(literal, written) {
  const template = templateOf(literal, written);
  const tagged = isConstructStep(literal) && errorFieldsOf(literal.get('payload')) !== null;
  if (errorFieldsOf(literal) === null && !tagged) return `a literal computes nothing: a shape computed is built by \`get\`, its parts paths and quotes, write \`get ${template}\``;
  return `an error literal computes nothing: facts computed are built by \`get\` and \`raise\` makes them an error, write \`get ${template.slice(template.indexOf('!') + 1)}${tagged ? ` | tag ${literal.get('tag').literal}` : ''} | raise\``;
}

function heldAsALiteral(literal, Refusal, facts, written) {
  if (written.computesWithin(literal)) throw new Refusal({ found: literal, ...facts, message: literalMessage(literal, written) });
}

function laterStepMessage(step, written) {
  if (isPath(step)) return `a path is a value, which the verb that takes it reads: write \`get ${written.of(step)}\``;
  if (isTag(step)) return `a tag goes over the value in the pipe by \`tag\`: write \`tag ${written.of(step)}\``;
  if (isQuote(step)) return 'code runs on the value in the pipe by `apply`: write `apply ~(…)`';
  if (isSet(step) || isBareVec(step) || isBareMap(step) || isConstructStep(step)) return 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`';
  return 'a step is a command: a value stands at the head, where it is the subject, or as what a verb takes';
}

// [QSSYN#line]
function chainMessage(payload, index, written) {
  const bind = payload[payload.slice(0, index).findLastIndex(step => !isCallStep(step))];
  if (!isBindStep(bind) || !isTag(bind.get('body'))) return null;
  const [name, body] = [written.of(bind.get('name')), written.of(bind.get('body'))];
  return `the body of \`${name}\` on the line of its name is one step, \`${body}\`, and the commands after it are steps of the query: a chain stands in parentheses, \`${name} (${body} | …)\``;
}

function nameMessage(name, written) {
  return readsAsBareKeyword(name.name)
    ? `\`${written.of(name)}\` is the word of a literal, which a step reads as the value: declare another name`
    : `\`${written.of(name)}\` names nothing a step can call: a name begins with a letter or \`_\`, \`:first_name 5\``;
}

const QuoteElementNotStepError = declareRefusal('quote/ElementNotStepError');
const QuoteStepNotCommandError = declareRefusal('quote/StepNotCommandError');
const QuoteLiteralComputesError = declareRefusal('quote/LiteralComputesError');
const CallPayloadNotSchemaError = declareRefusal('call/PayloadNotSchemaError');
const CallNameNotCallableError = declareRefusal('call/NameNotCallableError');
const CallLiteralComputesError = declareRefusal('call/LiteralComputesError');
const BindPayloadNotSchemaError = declareRefusal('bind/PayloadNotSchemaError');
const BindNameNotCallableError = declareRefusal('bind/NameNotCallableError');
const BindLiteralComputesError = declareRefusal('bind/LiteralComputesError');
const ConstructPayloadNotSchemaError = declareRefusal('construct/PayloadNotSchemaError');
const ConstructLiteralComputesError = declareRefusal('construct/LiteralComputesError');
const FailPayloadNotOneStepError = declareRefusal('fail/PayloadNotOneStepError');
const FailStepNotCommandError = declareRefusal('fail/StepNotCommandError');
const GroupPayloadEmptyError = declareRefusal('group/PayloadEmptyError');

const isWord = value => holdsALiteral(value) || isGroupStep(value) || (isCallStep(value) && !value.has('modifiers'));
const isBody = value => (holdsALiteral(value) && !isDoc(value)) || isGroupStep(value) || isCallStep(value);
const vecOfOneAtLeast = isElement => value => isBareVec(value) && value.length > 0 && value.every(isElement);

const CALL = {
  tag: CALL_TAG, PayloadNotSchemaError: CallPayloadNotSchemaError,
  fields: { name: isKeyword, modifiers: vecOfOneAtLeast(isWord) }, required: ['name']
};
const BIND = {
  tag: BIND_TAG, PayloadNotSchemaError: BindPayloadNotSchemaError,
  fields: { name: isKeyword, docs: vecOfOneAtLeast(isDoc), body: isBody }, required: ['name']
};
const CONSTRUCT = {
  tag: CONSTRUCT_TAG, PayloadNotSchemaError: ConstructPayloadNotSchemaError,
  fields: { tag: isTag, payload: isPartOfALiteral }, required: ['tag', 'payload']
};

// [QSQUO#step]
function recordFrom(payload, record) {
  for (const name of record.required) if (!payload.has(name)) throw new record.PayloadNotSchemaError({ field: makeKeyword(name), found: null });
  for (const [name, value] of payload) {
    if (!Object.hasOwn(record.fields, name) || !record.fields[name](value)) throw new record.PayloadNotSchemaError({ field: makeKeyword(name), found: value });
  }
  return makeTagged(record.tag, new Map(payload));
}

// [QSQUO#step], [QSNAM#letters]
export function callOf(payload, written) {
  const call = recordFrom(payload, CALL);
  const name = call.get('name');
  if (!readsAsBareKeyword(name.name) || LITERAL_WORDS.has(name.name.split('/')[0])) throw new CallNameNotCallableError({ name, message: nameMessage(name, written) });
  (call.get('modifiers') ?? []).forEach((modifier, index) => {
    if (holdsALiteral(modifier)) heldAsALiteral(modifier, CallLiteralComputesError, { index }, written);
  });
  return call;
}

export function bindOf(payload, written) {
  const bind = recordFrom(payload, BIND);
  if (!bind.has('docs') && !bind.has('body')) throw new BindPayloadNotSchemaError({ field: makeKeyword('body'), found: null });
  const name = bind.get('name');
  if (!readsAsBareKeyword(name.name) || (!declaresKind(bind) && LITERAL_WORDS.has(name.name))) throw new BindNameNotCallableError({ name, message: nameMessage(name, written) });
  if (holdsALiteral(bind.get('body'))) heldAsALiteral(bind.get('body'), BindLiteralComputesError, {}, written);
  return bind;
}

// [QSQUO#step], [QSLIT#closed]
export function constructOf(payload) {
  const construct = recordFrom(payload, CONSTRUCT);
  if (construct.get('tag').name === ERROR_TAG.name && isOfTheKindOfErrors(construct.get('payload'))) throw new ConstructPayloadNotSchemaError({ field: makeKeyword('tag'), found: construct.get('tag') });
  return construct;
}

// [QSLIT#closed], [QSQUO#step]
export function constructOfData(payload, written) {
  const construct = constructOf(payload);
  heldAsALiteral(construct, ConstructLiteralComputesError, { found: payload }, written);
  return construct;
}

// [QSQUO#step], [QSSYN#step]
export function failOf(payload, written) {
  if (payload.length !== 1 || isFailStep(payload[0])) throw new FailPayloadNotOneStepError({ found: payload });
  const [step] = payload;
  if (isPath(step) || isQuote(step)) throw new FailStepNotCommandError({ message: laterStepMessage(step, written), found: step });
  if (partsOfALiteral(step).some(part => holdsWithin(part, held => isPath(held) || isQuote(held)))) {
    throw new FailStepNotCommandError({ message: `a literal that holds a path or a quote is the template \`get\` reads: write \`get ${written.quoting(step)}\``, found: step });
  }
  return makeTagged(FAIL_TAG, payload);
}

// [QSQUO#step]
export function groupOf(payload) {
  if (payload.length === 0) throw new GroupPayloadEmptyError({ found: payload });
  return makeTagged(GROUP_TAG, payload);
}

// [QSQUO#step], [QSSYN#step]
export function quoteOf(payload, written) {
  payload.forEach((element, index) => {
    if (!isStep(element)) throw new QuoteElementNotStepError({ index, found: element });
  });
  payload.forEach((step, index) => {
    if (holdsALiteral(step)) heldAsALiteral(step, QuoteLiteralComputesError, { index }, written);
  });
  payload.forEach((step, index) => {
    if (index > 0 && !standsAsCommand(step) && !isFailStep(step) && !declaresAName(payload[index - 1])) {
      throw new QuoteStepNotCommandError({ index, message: chainMessage(payload, index, written) ?? laterStepMessage(step, written), found: step });
    }
  });
  return makeQuote(payload);
}

// [QSBLD#fn], [QSBLD#kind]
export function builtFrom(body) {
  if (isConstructStep(body)) return body.get('tag').name;
  if (!isGroupStep(body)) return null;
  const [head, ...rest] = body.payload;
  if (rest.length === 0) return isConstructStep(head) ? head.get('tag').name : null;
  return isTag(head) ? head.name : null;
}

// [QSBLD#kind]
export const declaresKind = bind => !bind.has('body') || builtFrom(bind.get('body')) === 'kind';

// [QSPTH#get]
export function commandStep(name, modifiers) {
  const fields = new Map([['name', makeKeyword(name)]]);
  if (modifiers.length > 0) fields.set('modifiers', Object.freeze([...modifiers]));
  return makeTagged(CALL_TAG, fields);
}

export const groupStep = steps => makeTagged(GROUP_TAG, makeQuote(steps));

// [QSQUO#step]
function stepOfValue(value) {
  const fields = errorFieldsOf(value);
  if (fields !== null) return errorAtRest(new Map([...fields].map(([key, fact]) => [key, stepOfValue(fact)])));
  if (isSet(value)) return makeSet(value.map(stepOfValue));
  if (isQuote(value) && isPathAlone(value)) return constructOf(new Map([['tag', QUOTE_TAG], ['payload', Object.freeze([value[0]])]]));
  if (isQuote(value) || isDoc(value)) return value;
  if (isTagged(value)) return constructOf(new Map([['tag', value[TAG_HEADER_SYMBOL]], ['payload', stepOfValue(payloadBeneath(value))]]));
  if (isVec(value)) return Object.freeze(value.map(stepOfValue));
  return isMap(value) ? new Map([...value].map(([key, part]) => [key, stepOfValue(part)])) : value;
}

export function declarationStep(name, docs, value) {
  const body = isDoc(value) ? groupStep([value]) : stepOfValue(value);
  return makeTagged(BIND_TAG, new Map([['name', makeKeyword(name)], ['docs', Object.freeze([...docs])], ['body', body]]));
}

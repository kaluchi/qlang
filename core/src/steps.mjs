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
  const whole = templateWhole(literal, written);
  return Array.from(whole).length <= TEMPLATE_WITHIN ? whole : templateCut(literal, written);
}

// [QSLIT#closed]
const quoteWritten = part => isQuote(part) || (isConstructStep(part) && quoteWritten(part.get('payload')));

function templateWhole(literal, written) {
  if (quoteWritten(literal)) return `(${written.stepOf(literal)})`;
  if (isComputingStep(literal) || !holdsWithin(literal, quoteWritten)) return written.stepOf(literal);
  if (isConstructStep(literal)) return `${literal.get('tag').literal}${templateWhole(literal.get('payload'), written)}`;
  const fields = errorFieldsOf(literal);
  if (fields !== null) return `!{${entriesWhole(fields, written)}}`;
  if (isBareMap(literal)) return `{${entriesWhole(literal, written)}}`;
  return `${isSet(literal) ? '#[' : '['}${literal.map(part => templateWhole(part, written)).join(' ')}]`;
}

const entriesWhole = (entries, written) => [...entries].map(([key, part]) => `${canonicalKeywordLiteral(key)} ${templateWhole(part, written)}`).join(' ');

function templateCut(literal, written) {
  if (isComputingStep(literal)) return written.stepOf(literal);
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
  if (errorFieldsOf(literal) === null && !tagged) {
    const shape = isConstructStep(literal) ? `${templateOf(literal.get('payload'), written)} | tag ${literal.get('tag').literal}` : template;
    return `a literal computes nothing: a shape computed is built by \`get\`, its parts paths and code, write \`get ${shape}\``;
  }
  const facts = template.slice(template.indexOf('!') + (tagged ? 0 : 1));
  return `an error literal computes nothing: facts computed are built by \`get\` and \`raise\` makes them an error, write \`get ${facts}${tagged ? ` | tag ${literal.get('tag').literal}` : ''} | raise\``;
}

export function heldAsALiteral(literal, Refusal, facts, written) {
  if (written.computesWithin(literal)) throw new Refusal({ found: literal, ...facts, message: literalMessage(literal, written) });
}

function laterStepMessage(step, written) {
  if (isPath(step)) return `a path is a value, which the verb that takes it reads: write \`get ${written.of(step)}\``;
  if (isTag(step)) return `a tag goes over the value in the pipe by \`tag\`: write \`tag ${written.of(step)}\``;
  if (isQuote(step)) return 'code runs on the value in the pipe by `apply`: write `apply (…)`';
  if (isSet(step) || isBareVec(step) || isBareMap(step) || isConstructStep(step)) return 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`';
  return 'a step is a command: a value stands at the head, where it is the subject, or as what a verb takes';
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
export const CallLiteralComputesError = declareRefusal('call/LiteralComputesError');
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
    throw new FailStepNotCommandError({ message: `a literal that holds a path or a quote is the template \`get\` reads: write \`get ${written.stepOf(step)}\``, found: step });
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
    if (index > 0 && !standsAsCommand(step) && !isFailStep(step) && !isBindStep(payload[index - 1])) {
      throw new QuoteStepNotCommandError({ index, message: laterStepMessage(step, written), found: step });
    }
  });
  // [QSQUO#step]
  const query = payload.findIndex(step => !isBindStep(step));
  const later = payload.findIndex((step, index) => (query !== -1 && index > query && isBindStep(step)) || (isFailStep(step) && isBindStep(step.payload[0])));
  if (later !== -1) throw new QuoteStepNotCommandError({ index: later, message: 'a declaration stands at the head of its text, before the query, each ended by `;`', found: payload[later] });
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
  const fields = new Map([['name', makeKeyword(name)]]);
  if (docs.length > 0) fields.set('docs', Object.freeze([...docs]));
  return makeTagged(BIND_TAG, fields.set('body', body));
}

// [QSQUO#held]
const NAMES_READ = new WeakMap();

export function namesAQuoteReads(quote) {
  let names = NAMES_READ.get(quote);
  if (names === undefined) {
    const read = new Set();
    namesOfAPipeline(quote, new Set(), read);
    names = Object.freeze([...read]);
    NAMES_READ.set(quote, names);
  }
  return names;
}

function namesOfAPipeline(steps, around, read) {
  const declared = new Set(around);
  for (const written of steps) {
    const step = isFailStep(written) ? written.payload[0] : written;
    namesOfAPart(step, declared, read);
    if (isBindStep(step)) declared.add(step.get('name').name);
  }
}

function namesOfAPart(part, declared, read) {
  if (isCallStep(part)) {
    const name = part.get('name').name;
    if (!name.includes('/') && !declared.has(name)) read.add(name);
    for (const modifier of part.get('modifiers') ?? []) namesOfAPart(modifier, declared, read);
  } else if (isBindStep(part)) {
    if (part.has('body') && !isQuote(part.get('body'))) namesOfAPart(part.get('body'), declared, read);
  } else if (isGroupStep(part)) namesOfAPipeline(part.payload, declared, read);
  else if (isQuote(part)) namesOfAPipeline(part, declared, read);
  else if (isTag(part)) {
    if (!part.name.includes('/') && !declared.has(part.name)) read.add(part.name);
  } else if (isConstructStep(part)) {
    namesOfAPart(part.get('tag'), declared, read);
    namesOfAPart(part.get('payload'), declared, read);
  } else if (!isDoc(part)) for (const held of partsOfALiteral(part)) namesOfAPart(held, declared, read);
}

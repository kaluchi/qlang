// [QSPRN#elide], [QSERR#alert]

import {
  isVec, isSet, isQuote, isDoc, isMap, isErrorValue, isValueClass, isFrame, isTrace,
  makeTagged, beneathTags, makeErrorValue, errorAtRest, makeFrame, partsOfFrame, makePath, makeQuote, makeTrace, stampTagHeader, TAG_HEADER_SYMBOL,
  SUBJECT_INDEX_OF_A_FRAME,
  ELISION_TAG
} from './types.mjs';
import { makeSet } from './ordering.mjs';
import { printValue, docText, printQuoteSource } from './print-value.mjs';
import { commandStep, FAIL_TAG } from './steps.mjs';

const HEAD_CHARACTERS = 40;
export const EXCERPT_CHARACTERS = 300;

// [QSPRN#budget]
export const ANSWER_BUDGET = 16000;
const printedByTheCore = () => undefined;

const REST_KEY = '…';

const measureBy = (printedOf, oneLine = false) => value => printValue(value, 0, printedOf, oneLine).length;

function isElision(value) {
  return isMap(value) && value[TAG_HEADER_SYMBOL]?.name === ELISION_TAG.name;
}

const isText = value => typeof value === 'string' || isDoc(value) || isQuote(value);

const isContainer = value => isVec(value) || isMap(value);

// [QSTXT#string]
export const lengthOf = text => Array.from(text).length;
const headOf = (text, length) => Array.from(text).slice(0, length).join('');

const OF_THE_VALUE = { caught: false, from: [] };
const OF_THE_FACTS = { caught: true, from: [] };

const readBelow = ({ caught, from }, segments) => ({ caught, from: [...from, ...segments] });

// [QSPTH#value]
function readOf(start, path, kept = null) {
  const segments = [...start.from, ...path].map(String);
  const steps = segments.length === 0 ? [] : [commandStep('get', [makePath(segments)])];
  if (kept !== null) steps.push(commandStep('drop', [kept]));
  if (start.caught) steps[0] = makeTagged(FAIL_TAG, makeQuote([steps[0] ?? commandStep('it', [])]));
  return makeQuote(steps);
}

function viewOf(start, printedOf, oneLine, rests) {
  return { start, printedOf, sizeOf: measureBy(printedOf, oneLine), built: new WeakSet(), rests };
}

const elisionOf = fields => makeTagged(ELISION_TAG, new Map(fields));

function partsOfContainer(value, view) {
  const parts = isMap(value) ? [...value] : value.map(element => [null, element]);
  const at = parts.findIndex(([, part]) => view.rests.has(part));
  const kept = at === -1 ? parts : parts.toSpliced(at, 1);
  return { entries: isMap(value) ? kept : kept.map(([, element], index) => [index, element]), standsFor: at === -1 ? 0 : parts[at][1].get('size') };
}

// [QSPRN#elide], [QSERR#alert]
function partsOf(value, path, view, parts) {
  if (isElision(value)) return;
  if (isErrorValue(value)) {
    for (const [name, fact] of value.facts) partsOf(fact, [...path, name], view, parts);
    return;
  }
  if (isText(value) || view.printedOf(value) !== undefined) {
    parts.push({ path, value });
    return;
  }
  if (isFrame(value)) return partsOf(partsOfFrame(value).subject, [...path, SUBJECT_INDEX_OF_A_FRAME], view, parts);
  if (isValueClass(value, 'underTag')) return partsOf(value.payload, path, view, parts);
  if (!isContainer(value)) return;
  const { entries } = partsOfContainer(value, view);
  if (path.length > 0 || entries.length > 1) parts.push({ path, value });
  for (const [key, part] of entries) partsOf(part, [...path, key], view, parts);
}

function textOf(value, view) {
  const printed = view.printedOf(value);
  if (printed !== undefined) return printed;
  const beneath = beneathTags(value);
  if (typeof beneath === 'string') return beneath;
  if (isDoc(beneath)) return docText(beneath);
  return isQuote(beneath) ? printQuoteSource(beneath) : undefined;
}

function countOf(value, view) {
  const beneath = beneathTags(value);
  if (!isContainer(beneath)) return view.sizeOf(value);
  const { entries, standsFor } = partsOfContainer(beneath, view);
  return entries.length + standsFor;
}

function wholeOf({ path, value }, view) {
  const text = textOf(value, view);
  const size = text === undefined ? countOf(value, view) : lengthOf(text);
  const fields = [['size', size], ['read', readOf(view.start, path)]];
  if (text !== undefined) fields.push(['head', headOf(text, Math.min(HEAD_CHARACTERS, Math.floor(size / 2)))]);
  return elisionOf(fields);
}

const halves = (value, view) => isContainer(value) && !isText(value) && view.printedOf(value) === undefined;

// [QSPRN#elide]
function halvedTo(part, kept, view) {
  const { path, value } = part;
  const { entries, standsFor } = partsOfContainer(value, view);
  const keeps = isMap(value) ? Math.min(kept, entries.findIndex(([key]) => key === REST_KEY) >>> 0) : kept;
  if (keeps === 0) return wholeOf(part, view);
  const rest = elisionOf([['size', entries.length - keeps + standsFor], ['read', readOf(view.start, path, keeps)]]);
  view.rests.add(rest);
  const halved = isMap(value) ? new Map([...entries.slice(0, keeps), [REST_KEY, rest]]) : [...entries.slice(0, keeps).map(([, element]) => element), rest];
  const header = value[TAG_HEADER_SYMBOL];
  if (header !== undefined) stampTagHeader(halved, header);
  view.built.add(halved);
  return halved;
}

function givenWay(part, view) {
  if (!halves(part.value, view)) return wholeOf(part, view);
  const { entries } = partsOfContainer(part.value, view);
  const kept = Math.ceil(entries.length / 2);
  return kept === entries.length ? wholeOf(part, view) : halvedTo(part, kept, view);
}

function leastOf(part, view) {
  return part.path.length === 0 && halves(part.value, view) ? halvedTo(part, 1, view) : wholeOf(part, view);
}

function replacedAt(value, path, replacement, view) {
  if (isErrorValue(value)) {
    const [name, ...rest] = path;
    const laid = makeErrorValue(value.tag, new Map(value.facts).set(name, replacedAt(value.facts.get(name), rest, replacement, view)));
    view.built.add(laid);
    return laid;
  }
  if (isValueClass(value, 'underTag') && (path.length > 0 || !isElision(replacement))) {
    const laid = makeTagged(value.tag, replacedAt(value.payload, path, replacement, view));
    view.built.add(laid);
    return laid;
  }
  if (path.length === 0) return replacement;
  const [head, ...rest] = path;
  const copy = isVec(value) ? [...value] : new Map(value);
  if (isVec(value)) copy[head] = replacedAt(value[head], rest, replacement, view);
  else copy.set(head, replacedAt(value.get(head), rest, replacement, view));
  const header = value[TAG_HEADER_SYMBOL];
  if (header !== undefined) stampTagHeader(copy, header);
  view.built.add(copy);
  return copy;
}

function inOrder(value, view) {
  if (!view.built.has(value)) return value;
  if (isErrorValue(value)) return makeErrorValue(value.tag, new Map([...value.facts].map(([name, fact]) => [name, inOrder(fact, view)])));
  if (isValueClass(value, 'underTag')) return makeTagged(value.tag, inOrder(value.payload, view));
  if (isSet(value)) return makeSet(value.map(element => inOrder(element, view)));
  const rebuilt = isMap(value)
    ? new Map([...value].map(([key, part]) => [key, inOrder(part, view)]))
    : value.map(part => inOrder(part, view));
  const header = value[TAG_HEADER_SYMBOL];
  if (header !== undefined) stampTagHeader(rebuilt, header);
  return rebuilt;
}

const largestOf = sized => sized.reduce((best, candidate) => (candidate.size > best.size ? candidate : best));
const isWithin = (path, around) => path.length > around.length && around.every((segment, index) => path[index] === segment);

function partGivingWay(sized) {
  let chosen = largestOf(sized);
  for (;;) {
    const bulk = sized.filter(({ part, size }) => isWithin(part.path, chosen.part.path) && size * 2 > chosen.size);
    if (bulk.length === 0) return chosen.part;
    chosen = largestOf(bulk);
  }
}

function elideWithin(value, budget, start, printedOf, oneLine = false, rests = new WeakSet()) {
  const view = viewOf(start, printedOf, oneLine, rests);
  let shown = value;
  while (view.sizeOf(shown) > budget) {
    const parts = [];
    partsOf(shown, [], view, parts);
    const sized = parts.map(part => ({ part, size: view.sizeOf(part.value) }))
      .filter(({ part, size }) => view.sizeOf(leastOf(part, view)) < size);
    if (sized.length === 0) break;
    const part = partGivingWay(sized);
    shown = replacedAt(shown, part.path, givenWay(part, view), view);
  }
  return inOrder(shown, view);
}

export function elideToBudget(value, budget, printedOf = printedByTheCore) {
  return elideWithin(value, budget, OF_THE_VALUE, printedOf);
}

function excerptOf(value, read, printedOf, oneLine, rests) {
  const cut = elideWithin(value, EXCERPT_CHARACTERS, read, printedOf, oneLine, rests);
  return measureBy(printedOf, oneLine)(cut) > EXCERPT_CHARACTERS ? passedOver(value, read, printedOf, oneLine, rests) : cut;
}

function passedOver(value, read, printedOf, oneLine, rests) {
  const view = viewOf(read, printedOf, oneLine, rests);
  const text = textOf(value, view);
  const shown = elisionOf([['size', text === undefined ? countOf(value, view) : lengthOf(text)], ['read', readOf(read, [])]]);
  return view.sizeOf(shown) < view.sizeOf(value) ? shown : value;
}

// [QSERR#alert]
function framesOf(trace, read, printedOf, rests) {
  return makeTrace(trace.map((frame, index) => {
    const { subject, unfinished, path } = partsOfFrame(frame);
    const subjectRead = readBelow(read, [index, SUBJECT_INDEX_OF_A_FRAME]);
    return makeFrame(index === 0 ? excerptOf(subject, subjectRead, printedOf, true, rests) : passedOver(subject, subjectRead, printedOf, true, rests), unfinished, path);
  }));
}

export function alertOf(error, printedOf = printedByTheCore, rests = new WeakSet()) {
  const facts = new Map();
  for (const [name, value] of error.facts) {
    const factRead = readBelow(OF_THE_FACTS, [name]);
    facts.set(name, isTrace(value) ? framesOf(value, factRead, printedOf, rests) : excerptOf(value, factRead, printedOf, false, rests));
  }
  return makeErrorValue(error.tag, facts);
}

export function alertWithin(error, budget, printedOf = printedByTheCore) {
  const rests = new WeakSet();
  const alert = alertOf(error, printedOf, rests);
  if (measureBy(printedOf)(alert) <= budget) return alert;
  const trace = alert.facts.get('trace');
  const excerpted = trace === undefined ? alert
    : makeErrorValue(alert.tag, new Map(alert.facts).set('trace', elideWithin(trace, EXCERPT_CHARACTERS, readBelow(OF_THE_FACTS, ['trace']), printedOf, false, rests)));
  return elideWithin(excerpted, budget, OF_THE_FACTS, printedOf, false, rests);
}

export function headOfAnswer(answer, printedOf = printedByTheCore) {
  if (!isErrorValue(answer)) return excerptOf(answer, OF_THE_VALUE, printedOf, false, new WeakSet());
  return excerptOf(errorAtRest(answer.tag, answer.facts), OF_THE_FACTS, printedOf, false, new WeakSet());
}

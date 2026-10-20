// The view of a value within a budget of characters of its print [D393]:
// while the print exceeds the budget, the largest part, or a part within it
// that prints more than half of it, gives way to an elision, a value of the
// kind `::elision`. A vector, a set and a map keep their first parts and an
// elision of the rest, a map's under the key `:"…"`, halving until they give
// way whole, the top keeping its first part at the least; a value under a tag
// is cut as its payload, its tag kept over the cut; a string, a doc, a quote
// and a part a kind prints its own way give way whole, their elision keeping
// the first characters of their text, or of that print, under `:head`; and an
// atom stands. A part gives way only where the least it gives way to prints
// shorter than it. An elision holds `:size`, what its `:read`, applied to the
// value taken, answers counted, and `:read`; an elision the value taken holds
// counts as one element, the view telling the rest by the elisions it made.
//
// A failure a host prints is an alert [QSHST#answer]: its tag and its facts, the data
// it carries cut to what places the failure. The subject of the first frame
// of its trace, where the failure arose, and every other fact print within an
// excerpt each; the subject of every later frame, which the failure only
// passed, gives way whole. Every `:read` reads its part beneath `!|`.
//
//   elide(value, budget, printedOf?) → the value within the budget
//   alertOf(error, printedOf?) → the error as an alert
//   elideAnswer(answer, budget, printedOf?) → an answer as a host prints it: a
//     value whole, or within the budget asked for; an error an alert, within
//     the budget when one is asked for
//
// where `printedOf(part)` answers the print a kind declared under it gives a
// part, or undefined where the forms of the core write it.

import {
  isVec, isSet, isQuote, isDoc, isMap, isErrorValue, isValueClass, isFrame, isTrace,
  makeTagged, beneathTags, makeErrorValue, makeFrame, partsOfFrame, makePath, makeQuote, makeTrace, stampTagHeader, TAG_HEADER_SYMBOL,
  SUBJECT_INDEX_OF_A_FRAME,
  ELISION_TAG
} from './types.mjs';
import { makeSet } from './ordering.mjs';
import { printValue, docText, printQuoteSource } from './print-value.mjs';
import { commandStep, FAIL_TAG } from './steps.mjs';

const HEAD_CHARACTERS = 40;
export const EXCERPT_CHARACTERS = 300;
const printedByTheCore = () => undefined;

// The key a map's elision of its rest stands under.
const REST_KEY = '…';

const measureBy = (printedOf, oneLine = false) => value => printValue(value, 0, printedOf, oneLine).length;

// An elision is a map under `::elision`, the tag stamped on the map.
function isElision(value) {
  return isMap(value) && value[TAG_HEADER_SYMBOL]?.name === ELISION_TAG.name;
}

const isText = value => typeof value === 'string' || isDoc(value) || isQuote(value);

// A vector, a set, a frame's own kin and a map, plain or under a tag on
// themselves, the containers that halve.
const isContainer = value => isVec(value) || isMap(value);

// A text counts and cuts by its code points, as `count` and `take` do
// [QSTXT#string].
const lengthOf = text => Array.from(text).length;
const headOf = (text, length) => Array.from(text).slice(0, length).join('');

// Where the reads of a value start: the value itself, or beneath `!|` the
// facts of an alert, each read from the path `from` names.
const OF_THE_VALUE = { caught: false, from: [] };
const OF_THE_FACTS = { caught: true, from: [] };

const readBelow = ({ caught, from }, segments) => ({ caught, from: [...from, ...segments] });

// The read of a part: `get` with the path to it and `drop` after it where a
// container keeps its first parts, beneath `!|` for a fact of an alert
// [QSPTH#value]; the top read whole by the empty quote.
function readOf(start, path, kept = null) {
  const segments = [...start.from, ...path].map(String);
  const steps = segments.length === 0 ? [] : [commandStep('get', [makePath(segments)])];
  if (kept !== null) steps.push(commandStep('drop', [kept]));
  if (start.caught && steps.length > 0) steps[0] = makeTagged(FAIL_TAG, makeQuote([steps[0]]));
  return makeQuote(steps);
}

// The view under way: the containers it built and the elisions of a rest it
// made, the rest of a container told by its own elision alone.
function viewOf(value, start, printedOf, oneLine) {
  return { value, start, printedOf, sizeOf: measureBy(printedOf, oneLine), built: new WeakSet(), rests: new WeakSet() };
}

const elisionOf = fields => makeTagged(ELISION_TAG, new Map(fields));

// The parts of a container in its order, the elision of its rest the view made
// left out, and what that rest stands for: a vector's and a set's elements, a
// map's entries.
function partsOfContainer(value, view) {
  const entries = isMap(value) ? [...value] : value.map((element, index) => [index, element]);
  const last = entries.at(-1);
  const rest = last !== undefined && view.rests.has(last[1]) ? last[1] : null;
  return { entries: rest === null ? entries : entries.slice(0, -1), standsFor: rest === null ? 0 : rest.get('size') };
}

// Every part that may give way, with the path to it: a text and a part a kind
// prints its own way, at the top as beneath it; a container of more than one
// part at the top and of any beneath it, through the tags over it, and each of
// its parts; a frame's subject alone, its steps and its place kept
// [D393]; an elision, made or held, and an atom never.
function partsOf(value, path, view, parts) {
  if (isElision(value)) return;
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

// The elision a part gives way to whole: a text's and a printed part's with
// their head, a container's standing for every part it held.
function wholeOf({ path, value }, view) {
  const read = readOf(view.start, path);
  const printed = view.printedOf(value);
  if (isText(value) || printed !== undefined) {
    const text = printed ?? (typeof value === 'string' ? value : isDoc(value) ? docText(value) : printQuoteSource(value));
    const size = lengthOf(text);
    return elisionOf([['size', size], ['read', read], ['head', headOf(text, Math.min(HEAD_CHARACTERS, Math.floor(size / 2)))]]);
  }
  const { entries, standsFor } = partsOfContainer(value, view);
  return elisionOf([['size', entries.length + standsFor], ['read', read]]);
}

// A container keeping its first parts and ending with an elision of the rest,
// a map's under the key `:"…"`, its tag kept; a map whose kept entries hold the
// key `:"…"` of the data keeping those before it alone, and giving way whole
// where none stands before it [D393].
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

// What a part gives way to: a container its first half while it holds more
// than one part, and any other part, a container of one among them beneath the
// top, its elision.
function givenWay(part, view) {
  if (!isContainer(part.value) || isText(part.value) || view.printedOf(part.value) !== undefined) return wholeOf(part, view);
  const { entries } = partsOfContainer(part.value, view);
  const kept = Math.ceil(entries.length / 2);
  return kept === entries.length ? wholeOf(part, view) : halvedTo(part, kept, view);
}

// The least a part gives way to: a container at the top its first part and an
// elision of the rest, any other part its elision.
function leastOf(part, view) {
  const halving = part.path.length === 0 && isContainer(part.value) && !isText(part.value) && view.printedOf(part.value) === undefined;
  return halving ? halvedTo(part, 1, view) : wholeOf(part, view);
}

// The value with the part at the path given way, the tags over a container
// it halved kept over the cut.
function replacedAt(value, path, replacement, view) {
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

// The view as a value: each set it built stands in the one order again, its
// elision where `::elision` ranks, the reads of its elisions written against
// the order of the value taken [D393].
function inOrder(value, view) {
  if (!view.built.has(value)) return value;
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

// The part that gives way: the largest, or where a part within it prints
// more than half of it, that part in its place, as deep as such parts go.
function partGivingWay(sized) {
  let chosen = largestOf(sized);
  for (;;) {
    const bulk = sized.filter(({ part, size }) => isWithin(part.path, chosen.part.path) && size * 2 > chosen.size);
    if (bulk.length === 0) return chosen.part;
    chosen = largestOf(bulk);
  }
}

// While the print exceeds the budget, a part gives way among those whose
// least prints shorter than they do, a container halving on to its least at
// the most; where no part's least is shorter, the view stands over the budget.
// A view that prints on one line, the subject of a frame, is measured so
// [D393].
function elideWithin(value, budget, start, printedOf, oneLine = false) {
  const view = viewOf(value, start, printedOf, oneLine);
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

export function elide(value, budget, printedOf = printedByTheCore) {
  return elideWithin(value, budget, OF_THE_VALUE, printedOf);
}

// A fact of an alert within its excerpt, beneath the read that reaches it,
// cut as `elide` cuts it; a value whose cut still passes the excerpt gives
// way whole as a subject the failure passed does, so the excerpt holds
// whatever data the failure arose over.
function excerptOf(value, read, printedOf, oneLine = false) {
  const cut = elideWithin(value, EXCERPT_CHARACTERS, read, printedOf, oneLine);
  return measureBy(printedOf, oneLine)(cut) > EXCERPT_CHARACTERS ? passedOver(value, read, printedOf, oneLine) : cut;
}

// A subject the failure only passed, given way whole where its elision is
// the shorter print: the characters of a text through the tags over it,
// the elements or the entries it stands for, and the read that reaches it.
function passedOver(value, read, printedOf, oneLine = false) {
  const sizeOf = measureBy(printedOf, oneLine);
  const beneath = beneathTags(value);
  const size = isText(beneath) ? lengthOf(typeof beneath === 'string' ? beneath : isDoc(beneath) ? docText(beneath) : printQuoteSource(beneath))
    : isVec(value) ? value.length : isMap(value) ? value.size : sizeOf(value);
  const shown = elisionOf([['size', size], ['read', readOf(read, [])]]);
  return sizeOf(shown) < sizeOf(value) ? shown : value;
}

// The trace of an alert: each frame keeps its steps and its place, the
// subject of the first within its excerpt, of every later one given way
// whole, each measured on the one line a frame prints on [QSHST#answer].
function framesOf(trace, read, printedOf) {
  return makeTrace(trace.map((frame, index) => {
    const { subject, unfinished, place } = partsOfFrame(frame);
    const subjectRead = readBelow(read, [index, SUBJECT_INDEX_OF_A_FRAME]);
    return makeFrame(index === 0 ? excerptOf(subject, subjectRead, printedOf, true) : passedOver(subject, subjectRead, printedOf, true), unfinished, place);
  }));
}

export function alertOf(error, printedOf = printedByTheCore) {
  const facts = new Map();
  for (const [name, value] of error.facts) {
    const factRead = readBelow(OF_THE_FACTS, [name]);
    facts.set(name, isTrace(value) ? framesOf(value, factRead, printedOf) : excerptOf(value, factRead, printedOf));
  }
  return makeErrorValue(error.tag, facts);
}

// Within a budget an alert that fits stands; past it, its trace keeps its
// first frames within an excerpt of its own and ends with the elision of the
// rest, and then its facts give way within the budget, so the error stays one
// the core builds, and every `:read` reads beneath `!|` [D393].
export function elideAnswer(answer, budget = null, printedOf = printedByTheCore) {
  if (!isErrorValue(answer)) return budget === null ? answer : elide(answer, budget, printedOf);
  const alert = alertOf(answer, printedOf);
  const sizeOf = measureBy(printedOf);
  if (budget === null || sizeOf(alert) <= budget) return alert;
  const facts = new Map(alert.facts);
  if (facts.has('trace')) facts.set('trace', excerptOf(facts.get('trace'), readBelow(OF_THE_FACTS, ['trace']), printedOf));
  const header = sizeOf(alert) - sizeOf(alert.facts);
  return makeErrorValue(alert.tag, elideWithin(facts, budget - header, OF_THE_FACTS, printedOf));
}

// The view of a value within a budget of characters of its print [QSPRN#elide]:
// while the print exceeds the budget, the largest part, or a part within it
// that prints more than half of it, gives way to an elision, a value of the
// kind `::elision`. A vector, a set and a map keep their first parts and an
// elision of the rest, a map's under the key `:"…"`, halving until they give
// way whole, the top keeping its first part at the least; a value under a tag
// halves as its payload, its tag kept over what it keeps, and gives way whole
// with its tags; a string, a doc, a quote and a part a kind prints its own way
// give way whole, their elision keeping the first characters of their text, or
// of that print, under `:head`; and an atom stands. A part gives way only where
// the least it gives way to prints shorter than it. An elision holds `:read`
// and `:size`, the elements or the entries of a container its `:read`, applied
// to the value taken, answers, or the characters of a text or of a print; an
// elision the value taken holds counts as one element, the views of one answer
// telling the rest by the elisions they made.
//
// A failure a host prints is an alert [QSHST#answer]: its tag and its facts, the data
// it carries cut to what places the failure. The subject of the first frame
// of its trace, where the failure arose, and every other fact print within an
// excerpt each; the subject of every later frame, which the failure only
// passed, gives way whole. Past a budget its trace keeps its first frames
// within an excerpt of its own, and then its facts give way within the
// budget, the failure keeping its tag and the names of its facts. Every
// `:read` reads its part beneath `!|`.
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

// A vector and a map, under whatever tag they hold on themselves, the
// containers that halve, a set, a frame and a trace among them; a doc and a
// quote, vectors of kinds of their own, give way whole as texts.
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
// container keeps its first parts, beneath `!|` for a fact of an alert, which
// a read beneath it names [QSPTH#value]; the top read whole by the empty
// quote.
function readOf(start, path, kept = null) {
  const segments = [...start.from, ...path].map(String);
  const steps = segments.length === 0 ? [] : [commandStep('get', [makePath(segments)])];
  if (kept !== null) steps.push(commandStep('drop', [kept]));
  if (start.caught) steps[0] = makeTagged(FAIL_TAG, makeQuote([steps[0]]));
  return makeQuote(steps);
}

// A view under way: the containers it built, and the elisions of a rest the
// views of one answer made, which they share, the rest of a container told
// by its own elision alone.
function viewOf(start, printedOf, oneLine, rests) {
  return { start, printedOf, sizeOf: measureBy(printedOf, oneLine), built: new WeakSet(), rests };
}

const elisionOf = fields => makeTagged(ELISION_TAG, new Map(fields));

// The parts of a container in its order, the elision of its rest a view of
// the answer made left out wherever the one order put it, each element at its
// index without it, and what that rest stands for: a vector's and a set's
// elements, a map's entries.
function partsOfContainer(value, view) {
  const parts = isMap(value) ? [...value] : value.map(element => [null, element]);
  const at = parts.findIndex(([, part]) => view.rests.has(part));
  const kept = at === -1 ? parts : parts.toSpliced(at, 1);
  return { entries: isMap(value) ? kept : kept.map(([, element], index) => [index, element]), standsFor: at === -1 ? 0 : parts[at][1].get('size') };
}

// Every part that may give way, with the path to it: a text and a part a kind
// prints its own way, at the top as beneath it; a container of more than one
// part at the top and of any beneath it, through the tags over it, and each of
// its parts; a frame's subject alone, its steps and its place kept; and each
// fact of a failure, which keeps its tag and the names of its facts [QSPRN#elide], [QSHST#answer];
// an elision, made or held, and an atom never.
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

// The text a part gives way whole with: the print a kind gives it, or the
// text of a string, a doc or a quote through the tags over it; undefined for
// any other part.
function textOf(value, view) {
  const printed = view.printedOf(value);
  if (printed !== undefined) return printed;
  const beneath = beneathTags(value);
  if (typeof beneath === 'string') return beneath;
  if (isDoc(beneath)) return docText(beneath);
  return isQuote(beneath) ? printQuoteSource(beneath) : undefined;
}

// What a part given way whole stands for beside a text: the elements or the
// entries of a container, through the tags over it, and the characters of
// the print of any other value.
function countOf(value, view) {
  const beneath = beneathTags(value);
  if (!isContainer(beneath)) return view.sizeOf(value);
  const { entries, standsFor } = partsOfContainer(beneath, view);
  return entries.length + standsFor;
}

// The elision a part gives way to whole, a text's and a printed part's with
// their head.
function wholeOf({ path, value }, view) {
  const text = textOf(value, view);
  const size = text === undefined ? countOf(value, view) : lengthOf(text);
  const fields = [['size', size], ['read', readOf(view.start, path)]];
  if (text !== undefined) fields.push(['head', headOf(text, Math.min(HEAD_CHARACTERS, Math.floor(size / 2)))]);
  return elisionOf(fields);
}

// Whether a part halves: a container that is no text and that no kind prints
// its own way; any other part gives way whole.
const halves = (value, view) => isContainer(value) && !isText(value) && view.printedOf(value) === undefined;

// A container keeping its first parts and ending with an elision of the rest,
// a map's under the key `:"…"`, its tag kept; a map whose kept entries hold the
// key `:"…"` of the data keeping those before it alone, and giving way whole
// where none stands before it [QSPRN#elide].
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
  if (!halves(part.value, view)) return wholeOf(part, view);
  const { entries } = partsOfContainer(part.value, view);
  const kept = Math.ceil(entries.length / 2);
  return kept === entries.length ? wholeOf(part, view) : halvedTo(part, kept, view);
}

// The least a part gives way to: a container at the top its first part and an
// elision of the rest, any other part its elision.
function leastOf(part, view) {
  return part.path.length === 0 && halves(part.value, view) ? halvedTo(part, 1, view) : wholeOf(part, view);
}

// The value with the part at the path given way: a failure keeping its tag and
// the names of its facts, the tags over a container it halved kept over the
// cut, and a value given way whole giving way with its tags.
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

// The view as a value: each set it built stands in the one order again, its
// elision where `::elision` ranks, the reads of its elisions written against
// the order of the value taken [QSPRN#elide].
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
// [QSPRN#elide].
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

export function elide(value, budget, printedOf = printedByTheCore) {
  return elideWithin(value, budget, OF_THE_VALUE, printedOf);
}

// A fact of an alert within its excerpt, beneath the read that reaches it,
// cut as `elide` cuts it; a value whose cut still passes the excerpt gives
// way whole as a subject the failure passed does, so the excerpt holds
// whatever data the failure arose over.
function excerptOf(value, read, printedOf, oneLine, rests) {
  const cut = elideWithin(value, EXCERPT_CHARACTERS, read, printedOf, oneLine, rests);
  return measureBy(printedOf, oneLine)(cut) > EXCERPT_CHARACTERS ? passedOver(value, read, printedOf, oneLine, rests) : cut;
}

// A subject the failure only passed, given way whole where its elision is the
// shorter print: what it stands for counted as a part given way whole counts
// it, and the read that reaches it.
function passedOver(value, read, printedOf, oneLine, rests) {
  const view = viewOf(read, printedOf, oneLine, rests);
  const text = textOf(value, view);
  const shown = elisionOf([['size', text === undefined ? countOf(value, view) : lengthOf(text)], ['read', readOf(read, [])]]);
  return view.sizeOf(shown) < view.sizeOf(value) ? shown : value;
}

// The trace of an alert: each frame keeps its steps and its place, the
// subject of the first within its excerpt, of every later one given way
// whole, each measured on the one line a frame prints on [QSHST#answer].
function framesOf(trace, read, printedOf, rests) {
  return makeTrace(trace.map((frame, index) => {
    const { subject, unfinished, place } = partsOfFrame(frame);
    const subjectRead = readBelow(read, [index, SUBJECT_INDEX_OF_A_FRAME]);
    return makeFrame(index === 0 ? excerptOf(subject, subjectRead, printedOf, true, rests) : passedOver(subject, subjectRead, printedOf, true, rests), unfinished, place);
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

// Within a budget an alert that fits stands; past it, its trace keeps its
// first frames within an excerpt of its own, ending with the elision of the
// rest, and then its facts give way within the budget, the failure keeping
// its tag and the names of its facts. The views of one answer share the rests
// they made, so every `:size` counts what its `:read` answers beneath `!|`
// [QSHST#answer].
export function elideAnswer(answer, budget = null, printedOf = printedByTheCore) {
  if (!isErrorValue(answer)) return budget === null ? answer : elide(answer, budget, printedOf);
  const rests = new WeakSet();
  const alert = alertOf(answer, printedOf, rests);
  if (budget === null || measureBy(printedOf)(alert) <= budget) return alert;
  const trace = alert.facts.get('trace');
  const excerpted = trace === undefined ? alert
    : makeErrorValue(alert.tag, new Map(alert.facts).set('trace', elideWithin(trace, EXCERPT_CHARACTERS, readBelow(OF_THE_FACTS, ['trace']), printedOf, false, rests)));
  return elideWithin(excerpted, budget, OF_THE_FACTS, printedOf, false, rests);
}

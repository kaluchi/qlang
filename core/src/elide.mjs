// The view of a value within a budget of characters of its print
// [QSPRN#elide]: while the print exceeds the budget, the largest part, or a
// part within it that prints more than half of it, gives way to a value of
// the kind `::elision`, a vector or a set keeping the first
// half of its elements and ending with a marker of the rest, and a map, a
// string, a doc or a quote beneath the top giving way whole; the top keeps
// its shape, a vector or a set there halving to its first element at the
// least. A part gives way only where the least it gives way to prints
// shorter than it. A marker holds
// `:size`, what it stands for counted, `:read`, the quote that applied to the
// value taken answers the part left out, and for a string, a doc and a quote
// `:head`, the first characters of its text. The print measured is the one a
// host writes, a part a kind prints its own way standing as that kind prints
// it [QSPRN#print].
//
// A failure a host prints is an alert [QSHST#answer]: its tag and its facts, the data
// it carries cut to what places the failure. The subject of the first frame
// of its trail, where the failure arose, and every other fact print within an
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
  isVec, isSet, isQuote, isDoc, isVecOfOwnKind, isMap, isErrorValue, isValueClass, isFrame, isTrail,
  makeTagged, beneathTags, makeErrorValue, makeFrame, makePath, makeQuote, makeSet, makeTrail, stampTagHeader, TAG_HEADER_SYMBOL,
  ELISION_TAG, FAIL_TAG, SET_TAG
} from './types.mjs';
import { printValue } from './runtime/print-value.mjs';
import { commandStep, docText, printQuoteSource } from './quote.mjs';

const HEAD_CHARACTERS = 40;
const EXCERPT_CHARACTERS = 300;
const printedByTheCore = () => undefined;

const measureBy = (printedOf, oneLine = false) => value => printValue(value, 0, printedOf, oneLine).length;

// A marker is a map under `::elision`, the tag stamped on the map.
function isMarker(value) {
  return isMap(value) && value[TAG_HEADER_SYMBOL]?.name === ELISION_TAG.name;
}

// A vector of elements as a reader writes one and a set, which halve, a map of
// entries, and the text of a string, a doc and a quote: the parts that give
// way. A vector or a map under a tag keeps its own shape, its parts giving
// way within.
const isPlainVector = value => isVec(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isPlainMap = value => isMap(value) && value[TAG_HEADER_SYMBOL] === undefined;
const halves = value => isPlainVector(value) || isSet(value);
const isText = value => typeof value === 'string' || isDoc(value) || isQuote(value);
const isTaggedContainer = value => (isVec(value) || isMap(value)) && !isVecOfOwnKind(value);

const textOf = value => (typeof value === 'string' ? value : isDoc(value) ? docText(value) : printQuoteSource(value));

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
// vector keeps its first elements, beneath `!|` for a fact of an alert
// [QSPTH#value]; the top, which never gives way whole, is read by `drop`
// alone.
function readOf(start, path, kept = null) {
  const segments = [...start.from, ...path].map(String);
  const steps = segments.length === 0 ? [] : [commandStep('get', [makePath(segments)])];
  if (kept !== null) steps.push(commandStep('drop', [kept]));
  if (start.caught) steps[0] = makeTagged(FAIL_TAG, makeQuote([steps[0]]));
  return makeQuote(steps);
}

function marker(fields) {
  return makeTagged(ELISION_TAG, new Map(fields));
}

// Every part that may give way, with the path to it: the top when it is a
// vector or a set of more than one element, and beneath it each vector, set,
// map, string, doc and quote, a text through the tags over it; a set under a
// tag keeps its shape as every container under a tag does, a frame its steps
// and its place, its subject alone giving way [QSHST#answer], and a part a kind
// prints its own way stands as that kind prints it.
function partsOf(value, path, printedOf, parts, underTag = false) {
  if (isMarker(value) || printedOf(value) !== undefined) return;
  if (isFrame(value)) return partsOf(value[0], [...path, 0], printedOf, parts);
  const beneath = path.length > 0;
  if (beneath && isText(value)) parts.push({ path, value });
  if (halves(value)) {
    if (!underTag && (beneath || vectorParts(value).elements.length > 1)) parts.push({ path, value });
    value.forEach((element, index) => partsOf(element, [...path, index], printedOf, parts));
  } else if (isPlainMap(value)) {
    if (beneath) parts.push({ path, value });
    for (const [key, entryValue] of value) partsOf(entryValue, [...path, key], printedOf, parts);
  } else if (isTaggedContainer(value)) {
    if (isVec(value)) value.forEach((element, index) => partsOf(element, [...path, index], printedOf, parts));
    else for (const [key, entryValue] of value) partsOf(entryValue, [...path, key], printedOf, parts);
  } else if (isValueClass(value, 'underTag')) {
    partsOf(value.payload, path, printedOf, parts, true);
  }
}

// A vector's elements before the marker of its rest, a marker an element
// gave way to being an element, and what the rest stands for [QSPRN#elide].
function vectorParts(value) {
  const trailing = value.length > 0 && isRemainder(value[value.length - 1]) ? value[value.length - 1] : null;
  return { elements: trailing === null ? value : value.slice(0, -1), standsFor: trailing === null ? 0 : trailing.get('size') };
}

// The marker of a vector's rest, whose read drops the elements kept.
function isRemainder(value) {
  const read = isMarker(value) ? value.get('read') : null;
  const last = isQuote(read) ? read[read.length - 1] : null;
  return isMap(last) && last.get('name')?.name === 'drop';
}

// The marker a part gives way to whole: a text's with its head, a vector's
// and a set's standing for every element it held, a map's for its entries.
function wholeOf(part, start) {
  const { path, value } = part;
  if (isText(value)) {
    const text = textOf(value);
    const size = lengthOf(text);
    return marker([['size', size], ['read', readOf(start, path)], ['head', headOf(text, Math.min(HEAD_CHARACTERS, Math.floor(size / 2)))]]);
  }
  if (halves(value)) {
    const { elements, standsFor } = vectorParts(value);
    return marker([['size', elements.length + standsFor], ['read', readOf(start, path)]]);
  }
  return marker([['size', value.size], ['read', readOf(start, path)]]);
}

// A vector or a set keeping its first elements and ending with a marker of
// the rest, a set in the order of the value taken until the view is done.
function halvedTo({ path, value }, kept, start, working) {
  const { elements, standsFor } = vectorParts(value);
  const halved = [...elements.slice(0, kept), marker([['size', elements.length - kept + standsFor], ['read', readOf(start, path, kept)]])];
  if (isSet(value)) stampTagHeader(halved, SET_TAG);
  working.add(halved);
  return halved;
}

// What a part gives way to: a vector or a set its first half while it holds
// more than one element, and any other part, a vector of one among them, its
// marker.
function givenWay(part, start, working) {
  if (!halves(part.value)) return wholeOf(part, start);
  const { elements } = vectorParts(part.value);
  const kept = Math.ceil(elements.length / 2);
  return kept === elements.length ? wholeOf(part, start) : halvedTo(part, kept, start, working);
}

// The least a part gives way to: the top its first element and a marker of
// the rest, any other part its marker.
function leastOf(part, start, working) {
  return part.path.length === 0 ? halvedTo(part, 1, start, working) : wholeOf(part, start);
}

function replacedAt(value, path, replacement, working) {
  if (path.length === 0) return replacement;
  if (isValueClass(value, 'underTag')) {
    const wrapped = makeTagged(value.tag, replacedAt(value.payload, path, replacement, working));
    working.add(wrapped);
    return wrapped;
  }
  const [head, ...rest] = path;
  const copy = isVec(value) ? [...value] : new Map(value);
  if (isVec(value)) copy[head] = replacedAt(value[head], rest, replacement, working);
  else copy.set(head, replacedAt(value.get(head), rest, replacement, working));
  const header = value[TAG_HEADER_SYMBOL];
  if (header !== undefined) stampTagHeader(copy, header);
  working.add(copy);
  return copy;
}

// The view as a value: each set elide built stands in the one order again
// [QSORD#order], the reads of its markers written against the order of the
// value taken.
function inOrder(value, working) {
  if (!working.has(value)) return value;
  if (isValueClass(value, 'underTag')) return makeTagged(value.tag, inOrder(value.payload, working));
  if (isSet(value)) return makeSet(value.map(element => inOrder(element, working)));
  const rebuilt = isMap(value)
    ? new Map([...value].map(([key, part]) => [key, inOrder(part, working)]))
    : value.map(part => inOrder(part, working));
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
// least prints shorter than they do, a vector halving on to its least at the
// most; where no part's least is shorter, the view stands over the budget
// [QSPRN#elide]. A view that prints on one line, the subject of a frame, is
// measured so [QSHST#answer].
function elideWithin(value, budget, start, printedOf, oneLine = false) {
  const sizeOf = measureBy(printedOf, oneLine);
  const working = new WeakSet();
  let view = value;
  while (sizeOf(view) > budget) {
    const parts = [];
    partsOf(view, [], printedOf, parts);
    const sized = parts.map(part => ({ part, size: sizeOf(part.value) }))
      .filter(({ part, size }) => sizeOf(leastOf(part, start, working)) < size);
    if (sized.length === 0) break;
    const part = partGivingWay(sized);
    view = replacedAt(view, part.path, givenWay(part, start, working), working);
  }
  return inOrder(view, working);
}

export function elide(value, budget, printedOf = printedByTheCore) {
  return elideWithin(value, budget, OF_THE_VALUE, printedOf);
}

// A fact of an alert within its excerpt, beneath the read that reaches
// it: a text past the excerpt gives way whole with its head, and any
// other value, an error at rest among them [QSERR#rest], gives way within as
// `elide` cuts it; a value whose cut still passes the excerpt, a map at its
// top keeping its keys, gives way whole as a subject the failure passed
// does, so the excerpt holds whatever data the failure arose over.
function excerptOf(value, read, printedOf, oneLine = false) {
  if (isText(value) && printedOf(value) === undefined && lengthOf(textOf(value)) > EXCERPT_CHARACTERS) return wholeOf({ path: [], value }, read);
  const cut = elideWithin(value, EXCERPT_CHARACTERS, read, printedOf, oneLine);
  return measureBy(printedOf, oneLine)(cut) > EXCERPT_CHARACTERS ? passedOver(value, read, printedOf, oneLine) : cut;
}

// A subject the failure only passed, given way whole where its marker is
// the shorter print: the characters of a text through the tags over it,
// the elements or the entries it stands for, and the read that reaches it.
function passedOver(value, read, printedOf, oneLine = false) {
  const sizeOf = measureBy(printedOf, oneLine);
  const beneath = beneathTags(value);
  const size = isText(beneath) ? lengthOf(textOf(beneath)) : isVec(value) ? value.length : isMap(value) ? value.size : sizeOf(value);
  const shown = marker([['size', size], ['read', readOf(read, [])]]);
  return sizeOf(shown) < sizeOf(value) ? shown : value;
}

// The trail of an alert: each frame keeps its steps and its place, the
// subject of the first within its excerpt, of every later one given way
// whole, each measured on the one line a frame prints on [QSHST#answer].
function framesOf(trail, read, printedOf) {
  return makeTrail(trail.map(([subject, steps, place = null], index) => {
    const subjectRead = readBelow(read, [index, 0]);
    return makeFrame(index === 0 ? excerptOf(subject, subjectRead, printedOf, true) : passedOver(subject, subjectRead, printedOf, true), steps, place);
  }));
}

export function alertOf(error, printedOf = printedByTheCore) {
  const facts = new Map();
  for (const [name, value] of error.descriptor) {
    const factRead = readBelow(OF_THE_FACTS, [name]);
    facts.set(name, isTrail(value) ? framesOf(value, factRead, printedOf) : excerptOf(value, factRead, printedOf));
  }
  return makeErrorValue(error.tag, facts);
}

// Within a budget an alert gives way within its facts, its trail keeping its
// frames, so the error stays one the core builds, and every `:read` reads
// beneath `!|`.
export function elideAnswer(answer, budget = null, printedOf = printedByTheCore) {
  if (!isErrorValue(answer)) return budget === null ? answer : elide(answer, budget, printedOf);
  const alert = alertOf(answer, printedOf);
  if (budget === null) return alert;
  const sizeOf = measureBy(printedOf);
  const header = sizeOf(alert) - sizeOf(alert.descriptor);
  const facts = elideWithin(new Map(alert.descriptor), budget - header, OF_THE_FACTS, printedOf);
  return makeErrorValue(alert.tag, facts);
}

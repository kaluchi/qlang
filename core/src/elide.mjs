// The view of a value within a budget of characters of its print [D109]:
// while the print exceeds the budget, the largest part beneath the top
// gives way to a value of the kind `::elision`, a vector keeping the
// first half of its elements and ending with a marker of the rest, a
// string or a map giving way whole, and the top, a vector, keeping the
// first half of its elements. A marker holds `:size`, what it stands for
// counted, `:read`, the quote that applied to the value taken answers the
// part left out, and for a string `:head`, its first characters.
//
//   elide(value, budget) → the value within the budget
//   elideAnswer(answer, budget) → an answer within the budget, a raised
//     error among them, whose facts give way beneath `!|`

import {
  isVec, isQMap, isQuote, isQSet, isDoc, isErrorValue, isValueClass,
  makeTaggedInstance, makeTagKeyword, makeErrorValue, stampTagHeader, TAG_HEADER_SYMBOL,
  canonicalKeywordLiteral
} from './types.mjs';
import { printValue } from './runtime/print-value.mjs';
import { quoteOfSource } from './quote.mjs';

const ELISION_TAG = makeTagKeyword('elision');
const HEAD_CHARACTERS = 40;

const printedSize = value => printValue(value).length;

// A marker is a map under `::elision`, the tag stamped on the map.
function isMarker(value) {
  return isQMap(value) && value[TAG_HEADER_SYMBOL]?.name === ELISION_TAG.name;
}

// A vector of elements as a reader writes one, and a map of entries: the
// parts that give way. A quote, a set and a doc keep their shape, and a
// vector or a map under a tag keeps its own, its parts giving way within.
const isPlainVector = value => isVec(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isPlainMap = value => isQMap(value) && value[TAG_HEADER_SYMBOL] === undefined;
const isTaggedContainer = value => (isVec(value) || isQMap(value)) && !isQuote(value) && !isQSet(value) && !isDoc(value);

// The step that reads one part of its parent: a field by its keyword, an
// element by its index.
function stepOf(key) {
  if (typeof key === 'number') return `/${key}`;
  const literal = canonicalKeywordLiteral(key);
  return /^:[^"]/.test(literal) ? `/${literal}` : ` | at ${literal}`;
}

function readOf(prefix, path, tail = '') {
  const steps = path.map(stepOf).join('');
  const body = `${prefix}${steps}${tail}`.replace(/^ \| /, '').trim();
  return quoteOfSource(body === '' ? '/' : body);
}

function marker(fields) {
  return makeTaggedInstance(ELISION_TAG, new Map(fields));
}

// Every part that may give way, with the path to it: the top when it is
// a vector, and beneath it each vector, map and string, through the tags
// over a value; the parts `keep` names give way within, never whole.
function partsOf(value, path, keep, parts) {
  if (isMarker(value)) return;
  const kept = keep(path);
  if (typeof value === 'string' && path.length > 0) parts.push({ path, value });
  if (isPlainVector(value)) {
    if (!kept) parts.push({ path, value });
    value.forEach((element, index) => partsOf(element, [...path, index], keep, parts));
  } else if (isPlainMap(value)) {
    if (path.length > 0 && !kept) parts.push({ path, value });
    for (const [key, entryValue] of value) partsOf(entryValue, [...path, key], keep, parts);
  } else if (isTaggedContainer(value)) {
    if (isVec(value)) value.forEach((element, index) => partsOf(element, [...path, index], keep, parts));
    else for (const [key, entryValue] of value) partsOf(entryValue, [...path, key], keep, parts);
  } else if (isValueClass(value, 'taggedInstance')) {
    partsOf(value.payload, path, keep, parts);
  }
}

// The marker or the shortened vector a part gives way to.
function givenWay(part, prefix) {
  const { path, value } = part;
  if (typeof value === 'string') {
    return marker([['size', value.length], ['read', readOf(prefix, path)], ['head', value.slice(0, Math.min(HEAD_CHARACTERS, Math.floor(value.length / 2)))]]);
  }
  if (isPlainVector(value)) {
    const trailing = value.length > 0 && isMarker(value[value.length - 1]) ? value[value.length - 1] : null;
    const elements = trailing === null ? value : value.slice(0, -1);
    const kept = Math.ceil(elements.length / 2);
    const standsFor = trailing === null ? 0 : trailing.get('size');
    if (kept === elements.length) {
      return marker([['size', elements.length + standsFor], ['read', readOf(prefix, path)]]);
    }
    const leftOut = elements.length - kept + standsFor;
    return [...elements.slice(0, kept), marker([['size', leftOut], ['read', readOf(prefix, path, ` | drop ${kept}`)]])];
  }
  return marker([['size', value.size], ['read', readOf(prefix, path)]]);
}

function replacedAt(value, path, replacement) {
  if (path.length === 0) return replacement;
  if (isValueClass(value, 'taggedInstance')) return makeTaggedInstance(value.tag, replacedAt(value.payload, path, replacement));
  const [head, ...rest] = path;
  const copy = isVec(value) ? [...value] : new Map(value);
  if (isVec(value)) copy[head] = replacedAt(value[head], rest, replacement);
  else copy.set(head, replacedAt(value.get(head), rest, replacement));
  const header = value[TAG_HEADER_SYMBOL];
  if (header !== undefined) stampTagHeader(copy, header);
  return copy;
}

function elideWithin(value, budget, prefix, keep) {
  let view = value;
  while (printedSize(view) > budget) {
    const parts = [];
    partsOf(view, [], keep, parts);
    const sized = parts.map(part => ({ part, size: printedSize(part.value) })).filter(({ size }) => size > 0);
    if (sized.length === 0) return view;
    const largest = sized.reduce((best, candidate) => (candidate.size > best.size ? candidate : best));
    view = replacedAt(view, largest.part.path, givenWay(largest.part, prefix));
  }
  return view;
}

export function elide(value, budget) {
  return elideWithin(value, budget, '', () => false);
}

// A raised error gives way within its facts: its trail keeps its stops,
// each of which may give way within, so the error stays one the core
// builds, and every `:read` reads beneath `!|`.

export function elideAnswer(answer, budget) {
  if (!isErrorValue(answer)) return elide(answer, budget);
  const header = printValue(answer).length - printedSize(answer.descriptor);
  const facts = elideWithin(new Map(answer.descriptor), budget - header, '!| ', path => path[0] === 'trail' && path.length <= 2);
  return makeErrorValue(answer.tag, facts);
}

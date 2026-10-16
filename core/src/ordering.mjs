// One order ranks every value [QSORD#order]: first by kind, null,
// boolean, number, string, pattern, keyword, tag name, path, vector, set,
// map, quote, doc, elision and desc, then every other tag by its name; within
// a kind numbers by value, a text by its code points, as a string counts
// them [QSTXT#string], patterns by their
// text and then their flags [QSTXT#pattern], vectors element
// by element, a set as its vector, maps by their keys and then their
// values, a desc by the reverse of its payload's place [QSORD#order], and a
// tagged value by its payload. `sort`, `min` and `max`
// order by it, and so do the ordering predicates, whose heads admit two
// values of one kind [QSDSP#walk], [QSDSP#residence].

import {
  isKeyword, isTag, isRegex, isPath, isDoc, isValueClass,
  TAG_HEADER_SYMBOL, QUOTE_TAG_NAME, SET_TAG_NAME
} from './types.mjs';

// The kinds in their order.
const NULL_KIND     = 0;
const BOOLEAN_KIND  = 1;
const NUMBER_KIND   = 2;
const STRING_KIND   = 3;
const REGEX_KIND    = 4;
const KEYWORD_KIND  = 5;
const TAG_NAME_KIND = 6;
// A path ranks after the tag names [QSPTH#value].
const PATH_KIND     = 7;
const VECTOR_KIND   = 8;
const SET_KIND      = 9;
const MAP_KIND      = 10;
const QUOTE_KIND    = 11;
const DOC_KIND      = 12;
const ELISION_KIND  = 13;
const DESC_KIND     = 14;
const TAGGED_KIND   = 15;

const ELISION_TAG_NAME = 'elision';
const DESC_TAG_NAME = 'desc';

function kindOf(value) {
  if (value === null || value === undefined) return NULL_KIND;
  if (typeof value === 'boolean') return BOOLEAN_KIND;
  if (typeof value === 'number') return NUMBER_KIND;
  if (typeof value === 'string') return STRING_KIND;
  if (isRegex(value)) return REGEX_KIND;
  if (isKeyword(value)) return KEYWORD_KIND;
  if (isTag(value)) return TAG_NAME_KIND;
  if (isPath(value)) return PATH_KIND;
  if (isDoc(value)) return DOC_KIND;
  const headerTag = value[TAG_HEADER_SYMBOL];
  if (headerTag === undefined) return shapeKindOf(value);
  if (headerTag.name === SET_TAG_NAME) return SET_KIND;
  if (headerTag.name === QUOTE_TAG_NAME) return QUOTE_KIND;
  if (headerTag.name === ELISION_TAG_NAME) return ELISION_KIND;
  if (headerTag.name === DESC_TAG_NAME) return DESC_KIND;
  return TAGGED_KIND;
}

// The kind a container has by its shape alone, which is the kind of a
// tagged container's payload.
function shapeKindOf(container) {
  return Array.isArray(container) ? VECTOR_KIND : MAP_KIND;
}

function compareNumbers(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// Two texts rank by their code points: their code units rank so but where
// a surrogate, half of a code point past the basic plane, meets a code unit
// at U+E000 or past it, which the code point of the pair ranks after.
function compareText(left, right) {
  const shared = Math.min(left.length, right.length);
  for (let at = 0; at < shared; at += 1) {
    let leftUnit = left.charCodeAt(at);
    let rightUnit = right.charCodeAt(at);
    if (leftUnit === rightUnit) continue;
    if (leftUnit >= 0xD800 && rightUnit >= 0xD800) {
      leftUnit += leftUnit >= 0xE000 ? -0x800 : 0x2000;
      rightUnit += rightUnit >= 0xE000 ? -0x800 : 0x2000;
    }
    return leftUnit < rightUnit ? -1 : 1;
  }
  return compareNumbers(left.length, right.length);
}

// Two paths rank segment by segment, a shorter one first where one
// begins the other.
function compareSegments(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const bySegment = compareText(left[index], right[index]);
    if (bySegment !== 0) return bySegment;
  }
  return left.length === right.length ? 0 : (left.length < right.length ? -1 : 1);
}

// compareValues(a, b) → -1 / 0 / 1 — the one order.
export function compareValues(a, b) {
  return compareKinded(kindOf(a), a, kindOf(b), b);
}

function compareKinded(leftKind, left, rightKind, right) {
  if (leftKind !== rightKind) return leftKind < rightKind ? -1 : 1;
  switch (leftKind) {
    case NULL_KIND:
      return 0;
    case BOOLEAN_KIND:
      return left === right ? 0 : (left ? 1 : -1);
    case NUMBER_KIND:
      return compareNumbers(left, right);
    case STRING_KIND:
      return compareText(left, right);
    case REGEX_KIND: {
      const bySource = compareText(left.source, right.source);
      return bySource !== 0 ? bySource : compareText(left.flags, right.flags);
    }
    case KEYWORD_KIND:
    case TAG_NAME_KIND:
      return compareText(left.name, right.name);
    case PATH_KIND:
      return compareSegments(left.segments, right.segments);
    case VECTOR_KIND:
    case SET_KIND:
    case QUOTE_KIND:
      return compareSequences(left, right);
    case MAP_KIND:
      return compareMaps(left, right);
    case DOC_KIND:
      return compareSequences(left, right);
    case ELISION_KIND:
      return comparePayloads(left, right);
    case DESC_KIND:
      return comparePayloads(right, left);
    default: {
      const byTag = compareText(left[TAG_HEADER_SYMBOL].name, right[TAG_HEADER_SYMBOL].name);
      return byTag !== 0 ? byTag : comparePayloads(left, right);
    }
  }
}

function compareSequences(leftItems, rightItems) {
  const sharedLength = Math.min(leftItems.length, rightItems.length);
  for (let index = 0; index < sharedLength; index++) {
    const byElement = compareValues(leftItems[index], rightItems[index]);
    if (byElement !== 0) return byElement;
  }
  return compareNumbers(leftItems.length, rightItems.length);
}

function sortedKeysOf(mapValue) {
  return [...mapValue.keys()].sort(compareText);
}

function compareMaps(leftMap, rightMap) {
  const leftKeys = sortedKeysOf(leftMap);
  const rightKeys = sortedKeysOf(rightMap);
  const sharedLength = Math.min(leftKeys.length, rightKeys.length);
  for (let index = 0; index < sharedLength; index++) {
    const byKey = compareText(leftKeys[index], rightKeys[index]);
    if (byKey !== 0) return byKey;
  }
  if (leftKeys.length !== rightKeys.length) return compareNumbers(leftKeys.length, rightKeys.length);
  for (const key of leftKeys) {
    const byValue = compareValues(leftMap.get(key), rightMap.get(key));
    if (byValue !== 0) return byValue;
  }
  return 0;
}

// A tagged container's payload is the container itself read by its
// shape; a tag over an atom or a value class wraps its payload.
function comparePayloads(leftTagged, rightTagged) {
  const [leftPayload, leftKind] = payloadOf(leftTagged);
  const [rightPayload, rightKind] = payloadOf(rightTagged);
  return compareKinded(leftKind, leftPayload, rightKind, rightPayload);
}

function payloadOf(tagged) {
  if (isValueClass(tagged, 'underTag')) return [tagged.payload, kindOf(tagged.payload)];
  return [tagged, shapeKindOf(tagged)];
}

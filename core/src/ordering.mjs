// One order ranks every value [D16]: first by kind, null,
// boolean, number, string, pattern, keyword, tag name, vector, set, map,
// quote, doc, elision and desc, then every other tag by its name; within
// a kind numbers by value, strings by their code units, patterns by their
// text and then their flags [D246], vectors element
// by element, a set as its vector, maps by their keys and then their
// values, a desc by the reverse of its payload's place [D140], and a
// tagged value by its payload. `sort`, `min` and `max`
// order by it, and so do the ordering predicates, whose heads admit two
// values of one kind [D34], [D72].

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
// A path ranks after the tag names [D248].
const PATH_KIND     = 6.5;
const VECTOR_KIND   = 7;
const SET_KIND      = 8;
const MAP_KIND      = 9;
const QUOTE_KIND    = 10;
const DOC_KIND      = 11;
const ELISION_KIND  = 12;
const DESC_KIND     = 13;
const TAGGED_KIND   = 14;

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

function compareCodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// compareValues(a, b) → -1 / 0 / 1 — the one order.
// Two paths rank segment by segment, a shorter one first where one
// begins the other.
function compareSegments(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const bySegment = compareCodeUnits(left[index], right[index]);
    if (bySegment !== 0) return bySegment;
  }
  return left.length === right.length ? 0 : (left.length < right.length ? -1 : 1);
}

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
    case STRING_KIND:
      return compareCodeUnits(left, right);
    case REGEX_KIND: {
      const bySource = compareCodeUnits(left.source, right.source);
      return bySource !== 0 ? bySource : compareCodeUnits(left.flags, right.flags);
    }
    case KEYWORD_KIND:
    case TAG_NAME_KIND:
      return compareCodeUnits(left.name, right.name);
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
      const byTag = compareCodeUnits(left[TAG_HEADER_SYMBOL].name, right[TAG_HEADER_SYMBOL].name);
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
  return compareCodeUnits(leftItems.length, rightItems.length);
}

function sortedKeysOf(mapValue) {
  return [...mapValue.keys()].sort(compareCodeUnits);
}

function compareMaps(leftMap, rightMap) {
  const leftKeys = sortedKeysOf(leftMap);
  const rightKeys = sortedKeysOf(rightMap);
  const sharedLength = Math.min(leftKeys.length, rightKeys.length);
  for (let index = 0; index < sharedLength; index++) {
    const byKey = compareCodeUnits(leftKeys[index], rightKeys[index]);
    if (byKey !== 0) return byKey;
  }
  if (leftKeys.length !== rightKeys.length) return compareCodeUnits(leftKeys.length, rightKeys.length);
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
  if (isValueClass(tagged, 'taggedInstance')) return [tagged.payload, kindOf(tagged.payload)];
  return [tagged, shapeKindOf(tagged)];
}

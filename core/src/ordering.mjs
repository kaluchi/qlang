// One order ranks every value [D16, D48]: first by kind, null,
// boolean, number, string, keyword, tag name, vector, set, map, quote,
// doc, error and elision, then every other tag by its name; within a
// kind numbers by value, strings by their code units, vectors element
// by element, a set as its vector, maps by their keys and then their
// values, and a tagged value by its payload. `sort`, `min` and `max`
// order by it. The ordering predicates keep their refusal of a pair of
// two kinds until the kinds of their slots carry it, so they gate the
// pair first (`checkComparable`) and then compare it in the one order.

import {
  isKeyword, isTagKeyword, isDoc, isErrorValue, isValueClass,
  TAG_HEADER_SYMBOL, QUOTE_TAG_NAME
} from './types.mjs';

// checkComparable(ErrorCls, left, right) — the pairs an ordering
// predicate compares: two numbers, two strings, two keywords or two
// tag names; any other pair throws the caller's per-site error.
export function checkComparable(ErrorCls, left, right) {
  const bothNumbers     = typeof left === 'number' && typeof right === 'number';
  const bothStrings     = typeof left === 'string' && typeof right === 'string';
  const bothKeywords    = isKeyword(left)    && isKeyword(right);
  const bothTagKeywords = isTagKeyword(left) && isTagKeyword(right);
  if (!bothNumbers && !bothStrings && !bothKeywords && !bothTagKeywords) {
    throw new ErrorCls(left, right);
  }
}

// The kinds in their order.
const NULL_KIND     = 0;
const BOOLEAN_KIND  = 1;
const NUMBER_KIND   = 2;
const STRING_KIND   = 3;
const KEYWORD_KIND  = 4;
const TAG_NAME_KIND = 5;
const VECTOR_KIND   = 6;
const SET_KIND      = 7;
const MAP_KIND      = 8;
const QUOTE_KIND    = 9;
const DOC_KIND      = 10;
const ERROR_KIND    = 11;
const ELISION_KIND  = 12;
const TAGGED_KIND   = 13;

const ELISION_TAG_NAME = 'elision';

function kindOf(value) {
  if (value === null || value === undefined) return NULL_KIND;
  if (typeof value === 'boolean') return BOOLEAN_KIND;
  if (typeof value === 'number') return NUMBER_KIND;
  if (typeof value === 'string') return STRING_KIND;
  if (isKeyword(value)) return KEYWORD_KIND;
  if (isTagKeyword(value)) return TAG_NAME_KIND;
  if (isDoc(value)) return DOC_KIND;
  if (isErrorValue(value)) return ERROR_KIND;
  const headerTag = value[TAG_HEADER_SYMBOL];
  if (headerTag === undefined) return shapeKindOf(value);
  if (headerTag.name === QUOTE_TAG_NAME) return QUOTE_KIND;
  if (headerTag.name === ELISION_TAG_NAME) return ELISION_KIND;
  return TAGGED_KIND;
}

// The kind a container has by its shape alone, which is the kind of a
// tagged container's payload.
function shapeKindOf(container) {
  if (Array.isArray(container)) return VECTOR_KIND;
  if (container instanceof Set) return SET_KIND;
  return MAP_KIND;
}

function compareCodeUnits(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
    case STRING_KIND:
      return compareCodeUnits(left, right);
    case KEYWORD_KIND:
    case TAG_NAME_KIND:
      return compareCodeUnits(left.name, right.name);
    case VECTOR_KIND:
    case QUOTE_KIND:
      return compareSequences(left, right);
    case SET_KIND:
      return compareSequences([...left].sort(compareValues), [...right].sort(compareValues));
    case MAP_KIND:
      return compareMaps(left, right);
    case DOC_KIND:
      return compareCodeUnits(left.content, right.content);
    case ERROR_KIND: {
      const byErrorTag = compareCodeUnits(left.tag.name, right.tag.name);
      return byErrorTag !== 0 ? byErrorTag : compareMaps(left.descriptor, right.descriptor);
    }
    case ELISION_KIND:
      return comparePayloads(left, right);
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
  return [...mapValue].map(([key]) => key).sort(compareCodeUnits);
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
// shape; a tagged scalar or value class wraps its payload.
function comparePayloads(leftTagged, rightTagged) {
  const [leftPayload, leftKind] = payloadOf(leftTagged);
  const [rightPayload, rightKind] = payloadOf(rightTagged);
  return compareKinded(leftKind, leftPayload, rightKind, rightPayload);
}

function payloadOf(tagged) {
  if (isValueClass(tagged, 'taggedInstance')) return [tagged.payload, kindOf(tagged.payload)];
  return [tagged, shapeKindOf(tagged)];
}

// [QSORD#order], [QSCND#compare]

import {
  isKeyword, isTag, isRegex, isPath, isDoc, isErrorValue, isValueClass, tagOf, makeTag, stampTagHeader,
  TAG_HEADER_SYMBOL, QUOTE_TAG_NAME, SET_TAG_NAME, SET_TAG, DESC_TAG, CORE_KIND
} from './types.mjs';

const NULL_KIND     = 0;
const BOOLEAN_KIND  = 1;
const NUMBER_KIND   = 2;
const STRING_KIND   = 3;
const REGEX_KIND    = 4;
const KEYWORD_KIND  = 5;
const TAG_NAME_KIND = 6;
// [QSPTH#value]
const PATH_KIND     = 7;
const VECTOR_KIND   = 8;
const SET_KIND      = 9;
const MAP_KIND      = 10;
const QUOTE_KIND    = 11;
const DOC_KIND      = 12;
// [QSORD#order], [QSORD#desc]
const TAGGED_KIND   = 13;
// [QSREQ#cases]
const RAISED_KIND   = 14;

// [QSHST#door]
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
  if (isErrorValue(value)) return RAISED_KIND;
  const kind = tagOf(value);
  if (kind === CORE_KIND.vec) return VECTOR_KIND;
  if (kind === CORE_KIND.map) return MAP_KIND;
  if (kind.name === SET_TAG_NAME) return SET_KIND;
  if (kind.name === QUOTE_TAG_NAME) return QUOTE_KIND;
  return TAGGED_KIND;
}

function coreKindOf(container) {
  return Array.isArray(container) ? VECTOR_KIND : MAP_KIND;
}

function compareNumbers(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

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

function compareSegments(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const bySegment = compareText(left[index], right[index]);
    if (bySegment !== 0) return bySegment;
  }
  return left.length === right.length ? 0 : (left.length < right.length ? -1 : 1);
}

export function compareValues(a, b) {
  return compareKinded(kindOf(a), a, kindOf(b), b);
}

// [QSORD#set]
export function makeSet(elements) {
  const ordered = [...elements].sort(compareValues);
  const set = ordered.filter((element, index) => index === 0 || compareValues(ordered[index - 1], element) !== 0);
  stampTagHeader(set, SET_TAG);
  return Object.freeze(set);
}

// [QSERR#site]
export function kindsExpected(...kindNames) {
  return makeSet(kindNames.map(makeTag));
}

// [QSORD#order], [QSORD#desc]
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
    case RAISED_KIND: {
      const byTag = compareText(left.tag.name, right.tag.name);
      return byTag !== 0 ? byTag : compareMaps(left.facts, right.facts);
    }
    default: {
      const byTag = compareText(left[TAG_HEADER_SYMBOL].name, right[TAG_HEADER_SYMBOL].name);
      if (byTag !== 0) return byTag;
      return left[TAG_HEADER_SYMBOL].name === DESC_TAG.name ? comparePayloads(right, left) : comparePayloads(left, right);
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

function comparePayloads(leftTagged, rightTagged) {
  const [leftPayload, leftKind] = payloadOf(leftTagged);
  const [rightPayload, rightKind] = payloadOf(rightTagged);
  return compareKinded(leftKind, leftPayload, rightKind, rightPayload);
}

function payloadOf(tagged) {
  if (isValueClass(tagged, 'underTag')) return [tagged.payload, kindOf(tagged.payload)];
  return [tagged, coreKindOf(tagged)];
}

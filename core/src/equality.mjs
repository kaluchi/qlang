// Structural deep equality across qlang values.
//
// A quote is a tagged vector of steps, so two quotes are equal when
// their steps are: the spacing and the comments of the text they were
// read from leave no step. A set is the vector in the one order
// without duplicates [D16], so two sets are equal when their elements
// are, index by index.

import {
  isKeyword, isTag, isRegex, isPath, isErrorValue, TAG_HEADER_SYMBOL,
  isValueClass, isQMap
} from './types.mjs';

// Two vectors or two maps are equal under one tag or under none.
function tagHeadersEqual(a, b) {
  return a[TAG_HEADER_SYMBOL]?.name === b[TAG_HEADER_SYMBOL]?.name;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  // A value under a tag's wrapper equals one under the same tag over an
  // equal payload.
  if (isValueClass(a, 'taggedInstance')) {
    return isValueClass(b, 'taggedInstance')
      && a.tag.name === b.tag.name
      && deepEqual(a.payload, b.payload);
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    if (!tagHeadersEqual(a, b)) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isQMap(a)) {
    if (!isQMap(b) || a.size !== b.size) return false;
    if (!tagHeadersEqual(a, b)) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }
  if (isKeyword(a)) {
    return isKeyword(b) && a.name === b.name;
  }
  if (isTag(a)) {
    return isTag(b) && a.name === b.name;
  }
  // Two patterns are one when their text and their flags are [D246].
  if (isRegex(a)) {
    return isRegex(b) && a.source === b.source && a.flags === b.flags;
  }
  // Two paths are one when their segments are [D248].
  if (isPath(a)) {
    return isPath(b) && a.segments.length === b.segments.length && a.segments.every((segment, index) => segment === b.segments[index]);
  }
  if (isErrorValue(a)) {
    return isErrorValue(b)
      && a.tag.name === b.tag.name
      && deepEqual(a.descriptor, b.descriptor);
  }
  return false;
}

// Structural deep equality across qlang values.
//
// A quote is a tagged vector of steps, so two quotes are equal when
// their steps are: the spacing and the comments of the text they were
// read from leave no step. A set is the vector in the one order
// without duplicates [D16], so two sets are equal when their elements
// are, index by index.

import {
  isKeyword, isTagKeyword, isErrorValue, isDoc, TAG_HEADER_SYMBOL,
  isValueClass, isQMap
} from './types.mjs';

// Tag identity comparator — Array/Map carry their identity
// on the JS-header `TAG_HEADER_SYMBOL` slot, so two collections
// with same elements but different (or absent) headers are not
// equal. `tagA?.name === tagB?.name` handles all three cases:
// both untagged (both undefined), both tagged identically, or
// tagged vs untagged / tagged differently.
function tagHeadersEqual(a, b) {
  return a[TAG_HEADER_SYMBOL]?.name === b[TAG_HEADER_SYMBOL]?.name;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  // Opaque TaggedInstance wrap object — checked before generic
  // object branches so its `.payload` recurses through the right
  // value-class path.
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
  if (isDoc(a)) {
    return isDoc(b) && a.content === b.content;
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
  if (isTagKeyword(a)) {
    return isTagKeyword(b) && a.name === b.name;
  }
  if (isErrorValue(a)) {
    return isErrorValue(b)
      && a.tag.name === b.tag.name
      && deepEqual(a.descriptor, b.descriptor);
  }
  return false;
}

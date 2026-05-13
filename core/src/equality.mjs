// Structural deep equality across qlang values.
//
// Shared by predicates.mjs (for the `eq` operand) and the
// conformance test runner.
//
// Cross-shape equivalences: a JsonArray and a Vec with the same
// elements are equal; a JsonObject and a Map with the same entries
// are equal. The JSON tag is an authoring/round-trip hint, not a
// semantic distinction at the equality level.

import {
  isKeyword, isTagKeyword, isErrorValue, isQuote, isDoc,
  isMapShape, mapShapeEntries, mapShapeSize, mapShapeHas, mapShapeGet
} from './types.mjs';

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isQuote(a)) {
    return isQuote(b) && a.source === b.source;
  }
  if (isDoc(a)) {
    return isDoc(b) && a.content === b.content;
  }
  if (isMapShape(a)) {
    if (!isMapShape(b) || mapShapeSize(a) !== mapShapeSize(b)) return false;
    for (const [k, v] of mapShapeEntries(a)) {
      if (!mapShapeHas(b, k) || !deepEqual(v, mapShapeGet(b, k))) return false;
    }
    return true;
  }
  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false;
    // JS Set's `.has` uses reference equality, which mishandles
    // composite elements (Vec / Map / Set / Error) — two
    // independently-constructed `[1 2]` Vecs are content-equal
    // but reference-distinct, so `b.has(v)` would fail. Linear
    // scan with `deepEqual` covers every shape uniformly:
    // keyword interning collapses to a single object on the
    // primitive side; composite shapes need the recursive
    // structural compare anyway. O(n²) is acceptable — Set
    // sizes in qlang queries stay small.
    outer: for (const v of a) {
      for (const w of b) {
        if (deepEqual(v, w)) continue outer;
      }
      return false;
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
    return isErrorValue(b) && deepEqual(a.descriptor, b.descriptor);
  }
  return false;
}

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
  isKeyword, isErrorValue, isQuote, isDoc,
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
    for (const v of a) {
      if (isKeyword(v)) {
        let found = false;
        for (const w of b) if (isKeyword(w) && w.name === v.name) { found = true; break; }
        if (!found) return false;
      } else if (!b.has(v)) return false;
    }
    return true;
  }
  if (isKeyword(a)) {
    return isKeyword(b) && a.name === b.name;
  }
  if (isErrorValue(a)) {
    return isErrorValue(b) && deepEqual(a.descriptor, b.descriptor);
  }
  return false;
}

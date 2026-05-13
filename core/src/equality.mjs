// Structural deep equality across qlang values, plus the
// `setHasStructurally` / `addStructurallyUnique` helpers that
// every Set-builder site (`evalSetLit`, `setops::union/inter/
// minus`, this module's own Set-equality branch) routes through.
//
// JS `Set` uses reference equality on `.has` / `.add`, which would
// mishandle composite elements (Vec / Map / Set / Error / etc.) —
// two independently-constructed `[1 2]` Vecs are content-equal
// but reference-distinct. The helpers below take a linear-scan
// `deepEqual` lookup over the existing members; O(n²) per Set
// build is acceptable because qlang Set sizes stay small enough
// that the constant on a hash-set would dominate, and structural
// dedup is the spec'd Set semantics.
//
// Cross-shape equivalences: a JsonArray and a Vec with the same
// elements are equal; a JsonObject and a Map with the same entries
// are equal. The JSON tag is an authoring/round-trip hint, not a
// semantic distinction at the equality level.

import {
  isKeyword, isTagKeyword, isErrorValue, isQuote, isDoc,
  isMapShape, mapShapeEntries, mapShapeSize, mapShapeHas, mapShapeGet
} from './types.mjs';

// setHasStructurally(set, v) — does the Set already carry a member
// structurally equal to `v`? Keyword interning collapses to
// `name`-equality (interned keywords have a single object identity
// per `name`, but the helper still goes through `name` so a freshly
// constructed `keyword(name)` matches an interned member); every
// other shape goes through `deepEqual`.
export function setHasStructurally(set, v) {
  if (isKeyword(v)) {
    for (const existing of set) {
      if (isKeyword(existing) && existing.name === v.name) return true;
    }
    return false;
  }
  for (const existing of set) {
    if (deepEqual(existing, v)) return true;
  }
  return false;
}

// addStructurallyUnique(set, v) — Set's spec'd `.add`: insert iff
// no structurally-equal member already lives there. The single
// builder primitive every Set mint site routes through.
export function addStructurallyUnique(set, v) {
  if (!setHasStructurally(set, v)) set.add(v);
}

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
    for (const v of a) if (!setHasStructurally(b, v)) return false;
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

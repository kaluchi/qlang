// Structural deep equality across qlang values, plus the
// `setHasStructurally` / `addStructurallyUnique` Set-builder
// primitives that every Set-mint site (`evalSetLit`,
// `setops::union/inter/minus`, this module's own Set-equality
// branch) routes through.
//
// JS `Set` uses reference equality on `.has` / `.add`, which would
// mishandle composite elements (Vec / Map / Set / Error / etc.) —
// two independently-constructed `[1 2]` Vecs are content-equal
// but reference-distinct. The Set-builder primitives below take a
// linear-scan `deepEqual` lookup over the existing members; O(n²)
// per Set build is acceptable because qlang Set sizes stay small
// enough that the constant on a hash-set would dominate, and
// structural dedup is the spec'd Set semantics.
//
// A quote is a tagged vector of steps, so two quotes are equal when
// their steps are: the spacing and the comments of the text they were
// read from leave no step.

import {
  isKeyword, isTagKeyword, isErrorValue, isDoc, TAG_HEADER_SYMBOL,
  isValueClass, isQMap
} from './types.mjs';

// Tag identity comparator — Array/Set/Map carry their identity
// on the JS-header `TAG_HEADER_SYMBOL` slot, so two collections
// with same elements but different (or absent) headers are not
// equal. `tagA?.name === tagB?.name` handles all three cases:
// both untagged (both undefined), both tagged identically, or
// tagged vs untagged / tagged differently.
function tagHeadersEqual(a, b) {
  return a[TAG_HEADER_SYMBOL]?.name === b[TAG_HEADER_SYMBOL]?.name;
}

// setHasStructurally(set, v) — does the Set already carry a member
// structurally equal to `v`? Keyword interning collapses to
// `name`-equality (interned keywords have a single object identity
// per `name`, but the predicate still goes through `name` so a freshly
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
  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false;
    if (!tagHeadersEqual(a, b)) return false;
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
    return isErrorValue(b)
      && a.tag.name === b.tag.name
      && deepEqual(a.descriptor, b.descriptor);
  }
  return false;
}

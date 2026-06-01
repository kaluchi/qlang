// Scalar total-order primitives — the comparability gate and the
// three-way comparator every order-aware operand routes its pairwise
// comparison through. `sort` / `min` / `max` / `asc` / `desc` /
// `nullsFirst` / `nullsLast` (runtime/vec.mjs) and `gt` / `lt` /
// `gte` / `lte` (runtime/predicates.mjs) share this one definition,
// so the set of well-ordered pairings stays identical across the
// sort axis and the ordering-predicate axis.
//
// Four matched-type pairings are well-defined: Number↔Number,
// String↔String, and the two identifier value-classes
// Keyword↔Keyword and TagKeyword↔TagKeyword (compared
// lexicographically by `.name` — the same `.name` axis keyword
// identity and `manifest` alphabetical order ride, so `[:x :y] |
// sort`, `#[:b :a :c] | sort`, and `[::A ::B] | sort` behave the
// natural way without an `as(:k) | k | keyword` dip into the string
// axis). Cross-type pairings (Keyword vs String, Number vs Boolean,
// Keyword vs TagKeyword) stay a comparability error: silent coercion
// across value-classes would mask the «sorted a heterogeneous
// collection by accident» bug. Each call site passes its own per-site
// ComparabilityError class so the throw still names the operand
// uniquely.

import { isKeyword, isTagKeyword } from './types.mjs';

// checkComparable(ErrorCls, left, right) — gate a pair against the
// matched-type rule; throw the caller's per-site ComparabilityError
// when the pair straddles value-classes.
export function checkComparable(ErrorCls, left, right) {
  const bothNumbers     = typeof left === 'number' && typeof right === 'number';
  const bothStrings     = typeof left === 'string' && typeof right === 'string';
  const bothKeywords    = isKeyword(left)    && isKeyword(right);
  const bothTagKeywords = isTagKeyword(left) && isTagKeyword(right);
  if (!bothNumbers && !bothStrings && !bothKeywords && !bothTagKeywords) {
    throw new ErrorCls(left, right);
  }
}

// compareScalars(a, b) → -1 / 0 / 1 — three-way comparator over a
// pair the caller has already gated through checkComparable.
// Identifier value-classes (Keyword, TagKeyword) compare by `.name`;
// Number / String ride the native relational operators.
export function compareScalars(a, b) {
  if (isKeyword(a) || isTagKeyword(a)) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

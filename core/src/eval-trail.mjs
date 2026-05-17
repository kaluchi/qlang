// Trail-fragment primitives.
//
// Three pure operations on an error value's deflection trail:
//
//   `trailEntry(stepNode, combinatorKind)` — forge a frozen
//     fragment record `{ combinator, text }` to append on a
//     success-track combinator deflect.
//
//   `combineTrailQuotes(existing, fresh)` — concatenate two
//     Quote-valued pipeline-suffix sources (or null) into one.
//     Used by `applyFailTrack` to merge the descriptor's existing
//     `:trail` Quote with the freshly-materialised `_trailHead`
//     before exposing the error to the fail-track step.
//
//   `materializePendingTrail(value)` — at every query / cell
//     boundary, walk an error value's `_trailHead` linked list
//     into its descriptor's `:trail` field so `printValue` reflects
//     the full deflection chain. Idempotent — re-running on an
//     already-materialised ErrorValue is a no-op because
//     `_trailHead` is null at that point.
//
// All three are pure — none of them re-enters the evaluator. They
// live next to (not inside) eval.mjs so the dependency edge points
// inward: eval.mjs's combinator handlers import these to compose
// trail records, but nothing here drags evalNode back into the
// trail module.

import {
  isErrorValue, makeErrorValue, makeQuote, materializeTrail
} from './types.mjs';

// Trail-fragment record stamped onto the linked-list head at every
// success-track combinator deflect site. `combinator` is one of
// the COMBINATOR_SYNTAX keys ('pipe' / 'distribute' / 'merge');
// `text` is the deflected step's source slice. `materializeTrail`
// joins fragments through COMBINATOR_SYNTAX into a single
// Quote-source carrying the pipeline-suffix as copy-pasteable code.
export function trailEntry(stepNode, combinatorKind) {
  return Object.freeze({
    combinator: combinatorKind,
    text: stepNode.text
  });
}

// combineTrailQuotes(existing, fresh) — both arguments are either a
// Quote-value (carrying a pipeline-suffix source string) or null.
// Concatenates their `.source` strings with a single space when both
// present so the joined fragment remains a syntactically valid
// pipeline-suffix; when only one side carries a Quote, it passes
// through unchanged. null + null → null.
export function combineTrailQuotes(existing, fresh) {
  if (existing == null) return fresh;
  if (fresh == null)    return existing;
  return makeQuote(existing.source + ' ' + fresh.source);
}

// materializePendingTrail(value) → value
//
// Walk `_trailHead`'s linked-list (deflected steps appended by
// success-track combinators) back into the descriptor's `:trail`
// field. Deflections through `|` / `*` / `>>` append to the head
// but only `!|` flushes it; a pipeline that ends without any fail-
// apply step would otherwise return an ErrorValue whose
// `_trailHead` carries the chain but whose printValue surface
// elides `:trail null` entirely. Called at every query / cell
// boundary so the printed form always reflects the full chain.
// Idempotent — re-running on an already-materialised ErrorValue is
// a no-op because `_trailHead` is null at that point.
export function materializePendingTrail(value) {
  if (!isErrorValue(value) || value._trailHead === null) return value;
  const combined = combineTrailQuotes(value.descriptor.get('trail'), materializeTrail(value));
  const next = new Map(value.descriptor);
  next.set('trail', combined);
  return makeErrorValue(next, {
    location: value.location,
    originalError: value.originalError
  });
}

// Trail-fragment primitives.
//
// Four pure operations on an error value's deflection trail:
//
//   `trailEntry(stepNode, combinatorKind)` — forge a frozen
//     fragment record `{ combinator, node }` to append on a
//     success-track combinator deflect.
//
//   `materializeTrail(errorValue)` — walk the fragments the error
//     gathered since it was minted into the quote of the deflected
//     steps.
//
//   `combineTrailQuotes(existing, fresh)` — join two pipeline-suffix
//     quotes (or null) into one. Used by `applyFailTrack` to merge the
//     descriptor's existing `:trail` quote with the freshly
//     materialised `_trailHead` before exposing the error to the
//     fail-track step.
//
//   `materializePendingTrail(value)` — at every query / cell
//     boundary, walk an error value's `_trailHead` linked list
//     into its descriptor's `:trail` field so `printValue` reflects
//     the full deflection chain. Idempotent — re-running on an
//     already-materialised ErrorValue is a no-op because
//     `_trailHead` is null at that point.
//
// None of them re-enters the evaluator. They live next to (not
// inside) eval.mjs so the dependency edge points inward: eval.mjs's
// combinator handlers import these to compose trail records, but
// nothing here drags evalNode back into the trail module.

import { isErrorValue, makeErrorValue, makeQuote } from './types.mjs';
import { stepOfNode, eachStepOf } from './quote.mjs';

// Trail-fragment record stamped onto the linked-list head at every
// success-track combinator deflect site. `combinator` is `'pipe'` or
// `'distribute'`; `node` is the deflected step, which
// `materializeTrail` turns into its step, a distributed body under
// `::each`.
export function trailEntry(stepNode, combinatorKind) {
  return Object.freeze({ combinator: combinatorKind, node: stepNode });
}

function stepOfFragment(fragment) {
  return fragment.combinator === 'distribute' ? eachStepOf(fragment.node) : stepOfNode(fragment.node);
}

export function materializeTrail(errorValue) {
  if (errorValue._trailHead === null) return null;
  const fragments = [];
  for (let cur = errorValue._trailHead; cur; cur = cur.prev) fragments.push(cur.entry);
  fragments.reverse();
  return makeQuote(fragments.map(stepOfFragment));
}

// combineTrailQuotes(existing, fresh) — both arguments are either a
// quote of deflected steps or null. Both present join into one quote,
// the existing steps first; when only one side carries a quote, it
// passes through unchanged. null + null → null.
export function combineTrailQuotes(existing, fresh) {
  if (existing == null) return fresh;
  if (fresh == null)    return existing;
  return makeQuote([...existing, ...fresh]);
}

// materializePendingTrail(value) → value
//
// Walk `_trailHead`'s linked-list (deflected steps appended by
// success-track combinators) back into the descriptor's `:trail`
// field. Deflections through `|` / `*` append to the head
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
  return makeErrorValue(value.tag, next, {
    location: value.location,
    originalError: value.originalError
  });
}

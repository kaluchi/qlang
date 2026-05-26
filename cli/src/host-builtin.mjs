// Host-operand binding wrapper for CLI-side builtins.
//
// CLI host operands (`@in`, `@out`, `pretty`, `tjson`, `parseJson`,
// ...) are dispatched through the same descriptor-Map path as the
// core catalog: every binding in env is a Map carrying `:impl
// <function-value>` with identity stamped on the JS-header
// `TAG_HEADER_SYMBOL` slot as `::builtin`. Wrapping host operands
// the same way means the function value lives in exactly one slot
// — `:impl` — where the render projection in `runtime/format.mjs`
// substitutes it back to the authoring keyword form
// `:qlang/prim/<name>` for round-trip.
//
// Without this wrapping, raw function-values leak through env when
// the user introspects env (`manifest`, `:name | source`, etc.) —
// printValue's Function-leak invariant fires because a bare function
// has no grammatical literal.
//
// Identity stamps via `stampTagHeader(descriptor, BUILTIN_TAG)` —
// matching the channel every `::builtin{…}` TaggedLit in the
// operand catalog writes into. `env | /pretty | type` reads
// `::builtin` regardless of whether the operand originated from
// the catalog or from a host-side binding; `manifest | filter(
// /kind | eq(::builtin))` partitions the same way through the
// view-Map's `:kind` enum-bucket field.

import { BUILTIN_TAG, stampTagHeader } from '@kaluchi/qlang-core';

export function bindHostBuiltin(session, name, operandFn) {
  // `evalOperandCall`'s `isBuiltinDescriptor` probe and
  // `manifest`'s descriptor routing both read
  // `TAG_HEADER_SYMBOL` — a host-installed binding dispatches
  // through the same path as a catalog operand.
  const descriptor = new Map([['impl', operandFn]]);
  stampTagHeader(descriptor, BUILTIN_TAG);
  session.bind(name, descriptor);
}

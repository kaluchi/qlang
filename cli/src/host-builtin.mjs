// Host-operand binding wrapper for CLI-side builtins.
//
// CLI host operands (`@in`, `@out`, `pretty`, `tjson`, `parseJson`,
// ...) are dispatched through the same descriptor-Map path as the
// core catalog: every binding in env is a Map carrying
// `:kind ::builtin` plus `:impl <function-value>`.
// Wrapping host operands the same way means the function value
// lives in exactly one slot — `:impl` — where the render
// projection in `runtime/format.mjs` substitutes it back to the
// authoring keyword form `:qlang/prim/<name>` for round-trip.
//
// Without this wrapping, raw function-values leak through env when
// the user introspects env (`manifest`, `:name | source`, etc.) —
// printValue's Function-leak invariant fires because a bare function
// has no grammatical literal.
//
// `:kind` is stamped as a TagKeyword (`::builtin`), matching the
// shape every `::builtin{…}` TaggedLit in the operand catalog
// produces — so `env | /pretty | /kind` reads back the same
// `::builtin` discriminator regardless of whether the operand
// originated from the catalog or from a host-side binding.

import { BUILTIN_TAG, stampTagHeader } from '@kaluchi/qlang-core';

export function bindHostBuiltin(session, name, operandFn) {
  // Identity rides on the Map JS-header TAG_HEADER_SYMBOL slot —
  // the same channel `langRuntime` stamps for catalog builtin
  // descriptors after Phase 4. `evalOperandCall`'s
  // `isBuiltinDescriptor` probe and `manifest`'s descriptor
  // routing both read the header, so a host-installed binding
  // dispatches through the same path as a catalog operand.
  const descriptor = new Map([['impl', operandFn]]);
  stampTagHeader(descriptor, BUILTIN_TAG);
  session.bind(name, descriptor);
}

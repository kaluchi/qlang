// Host-operand binding wrapper for CLI-side builtins.
//
// CLI host operands (`@in`, `@out`, `pretty`, `tjson`, `parseJson`,
// ...) are dispatched through the same descriptor-Map path as the
// core catalog: every binding in env is a Map carrying
// `:qlang/kind :builtin` plus `:qlang/impl <function-value>`.
// Wrapping host operands the same way means the function value
// lives in exactly one slot — `:qlang/impl` — where the render
// projection in `runtime/format.mjs` substitutes it back to the
// authoring keyword form `:qlang/prim/<name>` for round-trip.
//
// Without this wrapping, raw function-values leak through env when
// the user introspects env (`env | reify | source`, `manifest`,
// `:name | reify`, etc.) — printValue's Function-leak invariant
// fires because a bare function has no grammatical literal.

import { keyword } from '@kaluchi/qlang-core';

export function bindHostBuiltin(session, name, operandFn) {
  const descriptor = new Map([
    ['qlang/kind', keyword('builtin')],
    ['qlang/impl', operandFn]
  ]);
  session.bind(name, descriptor);
}

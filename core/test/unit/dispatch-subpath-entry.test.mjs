// Regression — `@kaluchi/qlang-core/dispatch` subpath entry must
// not trip TDZ via the cycle dispatch → eval → runtime/index →
// control → dispatch.
//
// The dispatch module exports the operand-registration surface
// (`valueOp`, `nullaryOp`, `overloadedOp`, `stateOp`,
// `stateOpVariadic`) that hosts (jdt, future bridges) bind their JS
// impls against. A static `import { mintTaggedInstance } from
// '../eval.mjs'` inside dispatch.mjs would close the cycle and trip
// ReferenceError at module-init time because `use-op.mjs` calls
// `stateOpVariadic` at its top level before the dispatch module body
// has reached the export.
//
// Vitest runs each test file in an isolated module graph, so this
// file's top-level imports reflect the host-side load order: a
// pure `dispatch.mjs`-first entry. If the cycle re-tightens, the
// `import` line below fails before any test body runs.

import { describe, it, expect } from 'vitest';
import {
  valueOp, nullaryOp, overloadedOp, stateOp, stateOpVariadic
} from '../../src/runtime/dispatch.mjs';

describe('runtime/dispatch.mjs subpath-first entry', () => {
  it('exports every operand-registration wrapper', () => {
    expect(typeof valueOp).toBe('function');
    expect(typeof nullaryOp).toBe('function');
    expect(typeof overloadedOp).toBe('function');
    expect(typeof stateOp).toBe('function');
    expect(typeof stateOpVariadic).toBe('function');
  });
});

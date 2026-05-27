// Regression — `@kaluchi/qlang-core/dispatch` subpath entry must
// not trip TDZ via the cycle dispatch → eval → runtime/index →
// control → dispatch.
//
// The dispatch module exports the operand-registration surface
// (`valueOp`, `higherOrderOp`, `nullaryOp`, `overloadedOp`,
// `UNBOUNDED`) that hosts (jdt, future bridges) bind their JS
// impls against. A static `import { mintTaggedInstance } from
// '../eval.mjs'` inside dispatch.mjs would close the cycle and
// trip ReferenceError on `UNBOUNDED` at module-init time because
// `control.mjs` references `UNBOUNDED` at its top level
// (`higherOrderOpVariadic('coalesce', 16, …, [1, UNBOUNDED])`)
// before the dispatch module body has reached the export.
//
// Vitest runs each test file in an isolated module graph, so this
// file's top-level imports reflect the host-side load order: a
// pure `dispatch.mjs`-first entry. If the cycle re-tightens, the
// `import` line below fails before any test body runs.

import { describe, it, expect } from 'vitest';
import {
  UNBOUNDED,
  valueOp, higherOrderOp, nullaryOp, overloadedOp,
  stateOp, stateOpVariadic, higherOrderOpVariadic
} from '../../src/runtime/dispatch.mjs';

describe('runtime/dispatch.mjs subpath-first entry', () => {
  it('exports a usable UNBOUNDED sentinel after a dispatch-first load', () => {
    expect(UNBOUNDED).toBeDefined();
    expect(UNBOUNDED.type).toBe('keyword');
    expect(UNBOUNDED.name).toBe('unbounded');
  });

  it('exports every operand-registration wrapper', () => {
    expect(typeof valueOp).toBe('function');
    expect(typeof higherOrderOp).toBe('function');
    expect(typeof nullaryOp).toBe('function');
    expect(typeof overloadedOp).toBe('function');
    expect(typeof stateOp).toBe('function');
    expect(typeof stateOpVariadic).toBe('function');
    expect(typeof higherOrderOpVariadic).toBe('function');
  });
});

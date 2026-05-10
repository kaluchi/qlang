// Unit coverage for printValue branches that fire only when a
// Conduit / Snapshot / Function value lands in pipeValue — paths
// reachable via `env | /name` ceremony (env-walk drops the descriptor
// Map directly into pipeValue) but not exercised by ordinary pipeline
// execution. Tests build the values directly and call printValue.

import { describe, it, expect } from 'vitest';
import { printValue, toPlain } from '../../src/runtime/format.mjs';
import {
  makeConduit,
  makeSnapshot,
  makeDoc,
  isConduit,
  isSnapshot,
  isDoc
} from '../../src/types.mjs';
import { makeFn } from '../../src/rule10.mjs';

describe('printValue — Conduit / Snapshot / Function branches', () => {
  it('renders a zero-arity Conduit as `def(:name, body)`', () => {
    const bodyAst = { type: 'NumberLit', value: 42, text: '42' };
    const conduit = makeConduit(bodyAst, { name: 'answer', params: [] });
    expect(isConduit(conduit)).toBe(true);
    expect(printValue(conduit)).toBe('def(:answer, 42)');
  });

  it('renders a parametric Conduit with [:params] in declaration order', () => {
    const bodyAst = { type: 'OperandCall', name: 'add', text: 'add(x, y)' };
    const conduit = makeConduit(bodyAst, { name: 'sum2', params: ['x', 'y'] });
    expect(printValue(conduit)).toBe('def(:sum2, [:x, :y], add(x, y))');
  });

  it('falls back to … when conduit body has no .text', () => {
    const conduit = makeConduit({ type: 'NumberLit', value: 1 }, { name: 'noTxt', params: [] });
    expect(printValue(conduit)).toBe('def(:noTxt, …)');
  });

  it('emits doc-comment prefixes before a documented Conduit', () => {
    const bodyAst = { type: 'NumberLit', value: 7, text: '7' };
    const conduit = makeConduit(bodyAst, {
      name: 'lucky',
      params: [],
      docs: [' first remark ', ' second remark ']
    });
    expect(printValue(conduit)).toBe(
      '|~~  first remark  ~~|\n|~~  second remark  ~~|\ndef(:lucky, 7)'
    );
  });

  it('renders a Snapshot by passing through to its wrapped value', () => {
    const snap = makeSnapshot([1, 2, 3], { name: 'nums' });
    expect(isSnapshot(snap)).toBe(true);
    expect(printValue(snap)).toBe('[1 2 3]');
  });

  it('renders a Doc value as `|~~content~~|` block form', () => {
    const doc = makeDoc(' hello ');
    expect(isDoc(doc)).toBe(true);
    expect(printValue(doc)).toBe('|~~ hello ~~|');
  });

  it('renders a Function value as :qlang/prim/<name>', () => {
    const fn = makeFn('myOperand', 1, async (state) => state, {
      category: 'test',
      subject: 'any',
      modifiers: [],
      returns: 'any',
      docs: [],
      examples: [],
      throws: []
    });
    expect(printValue(fn)).toBe(':qlang/prim/myOperand');
  });
});

describe('toPlain — exotic value fallback', () => {
  it('coerces a Function value to its String() form via the fallback branch', () => {
    const fn = makeFn('myExotic', 1, async (state) => state, {
      category: 'test',
      subject: 'any',
      modifiers: [],
      returns: 'any',
      docs: [],
      examples: [],
      throws: []
    });
    // toPlain has no Function handler — falls through to String(v)
    // which prints the JS object's [object Object]-style label. The
    // exact string is not part of the public contract; the branch
    // only needs to be exercised so coverage closes.
    const plain = toPlain(fn);
    expect(typeof plain).toBe('string');
  });
});

describe('table — Conduit / Snapshot / Function inside row Maps', () => {
  // table renders Vec of Maps via CELL_HANDLERS. Conduit / Snapshot /
  // Function values in cell positions reach the dispatch only when a
  // user explicitly piped them in (e.g. `env | /name | wrap-in-Map |
  // table`). Tests build the Vec directly so the cell handlers fire.
  it('renders a Conduit-valued cell as `def(:name, body)`', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const bodyAst = { type: 'NumberLit', value: 99, text: '99' };
    const conduit = makeConduit(bodyAst, { name: 'ninetyNine', params: [] });
    const row = new Map([['fn', conduit]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('def(:ninetyNine, 99)');
  });

  it('renders a Snapshot-valued cell as `as(:name)`', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const snap = makeSnapshot(42, { name: 'cached' });
    const row = new Map([['snap', snap]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('as(:cached)');
  });

  it('renders a Function-valued cell as <name>', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const fn = makeFn('myFn', 1, async (state) => state, {
      category: 'test', subject: 'any', modifiers: [],
      returns: 'any', docs: [], examples: [], throws: []
    });
    const row = new Map([['op', fn]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain(':qlang/prim/myFn');
  });

  it('renders a Vec-of-Conduit cell — INLINE handler for Conduit fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const bodyAst = { type: 'NumberLit', value: 7, text: '7' };
    const conduit = makeConduit(bodyAst, { name: 'inner', params: [] });
    const row = new Map([['fns', [conduit]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('def(:inner, 7)');
  });

  it('renders a Vec-of-Snapshot cell — INLINE handler for Snapshot fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const snap = makeSnapshot('hi', { name: 'greet' });
    const row = new Map([['snaps', [snap]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('as(:greet)');
  });

  it('renders a Vec-of-Function cell — INLINE handler for Function fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const fn = makeFn('inlineFn', 1, async (state) => state, {
      category: 'test', subject: 'any', modifiers: [],
      returns: 'any', docs: [], examples: [], throws: []
    });
    const row = new Map([['fns', [fn]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain(':qlang/prim/inlineFn');
  });

  it('falls back to … when Conduit cell body has no .text (CELL_HANDLERS branch)', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const conduit = makeConduit({ type: 'NumberLit', value: 1 }, { name: 'noText', params: [] });
    const row = new Map([['c', conduit]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('def(:noText, …)');
  });

  it('falls back to … when Conduit inside a Vec has no .text (INLINE_HANDLERS branch)', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const conduit = makeConduit({ type: 'NumberLit', value: 1 }, { name: 'inlineNoText', params: [] });
    const row = new Map([['vec', [conduit]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('def(:inlineNoText, …)');
  });

  it('renders a Vec-of-Quote cell — INLINE handler for Quote fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeQuote } = await import('../../src/types.mjs');
    const row = new Map([['q', [makeQuote('mul(2)')]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('`mul(2)`');
  });

  it('renders a Quote-valued cell — CELL_HANDLERS.Quote fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeQuote } = await import('../../src/types.mjs');
    const row = new Map([['q', makeQuote('add(1)')]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('`add(1)`');
  });

  it('renders a Doc-valued cell — CELL_HANDLERS.Doc fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeDoc } = await import('../../src/types.mjs');
    const row = new Map([['d', makeDoc(' note ')]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('|~~ note ~~|');
  });

  it('renders a Vec-of-Doc cell — INLINE handler for Doc fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeDoc } = await import('../../src/types.mjs');
    const row = new Map([['ds', [makeDoc(' inner ')]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('|~~ inner ~~|');
  });
});

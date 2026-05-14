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
  isDoc,
  ConduitBodyMissingSourceError,
  FunctionValueLeakedToPrintError
} from '../../src/types.mjs';
import { makeFn } from '../../src/rule10.mjs';

describe('printValue — Conduit / Snapshot / Function branches', () => {
  it('renders a zero-arity named Conduit as ~{::conduit[:name [] }body~{]}', () => {
    const bodyAst = { type: 'NumberLit', value: 42, text: '42' };
    const conduit = makeConduit(bodyAst, { name: 'answer', params: [] });
    expect(isConduit(conduit)).toBe(true);
    expect(printValue(conduit)).toBe('::conduit[:answer [] ~{42}]');
  });

  it('renders a parametric named Conduit with [:params] in declaration order', () => {
    const bodyAst = { type: 'OperandCall', name: 'add', text: 'add(x, y)' };
    const conduit = makeConduit(bodyAst, { name: 'sum2', params: ['x', 'y'] });
    expect(printValue(conduit)).toBe('::conduit[:sum2 [:x :y] ~{add(x, y)}]');
  });

  it('makeConduit refuses a body without .text — round-trip invariant', () => {
    // printValue's round-trip theorem requires every Conduit to print
    // back into parseable qlang source. A body without .text would
    // force a non-parseable placeholder, so mint refuses up front.
    expect(() =>
      makeConduit({ type: 'NumberLit', value: 1 }, { name: 'noTxt', params: [] })
    ).toThrow(ConduitBodyMissingSourceError);
  });

  it('docs do not appear in value-literal — they are declaration metadata, reachable via the ~{:name | docs} axis', () => {
    const bodyAst = { type: 'NumberLit', value: 7, text: '7' };
    const conduit = makeConduit(bodyAst, {
      name: 'lucky',
      params: [],
      docs: [' first remark ', ' second remark ']
    });
    expect(printValue(conduit)).toBe('::conduit[:lucky [] ~{7}]');
  });

  it('renders a Snapshot by passing through to its wrapped value', () => {
    const snap = makeSnapshot([1, 2, 3], { name: 'nums' });
    expect(isSnapshot(snap)).toBe(true);
    expect(printValue(snap)).toBe('[1 2 3]');
  });

  it('renders a Doc value as ~{|~~content~~|} block form', () => {
    const doc = makeDoc(' hello ');
    expect(isDoc(doc)).toBe(true);
    expect(printValue(doc)).toBe('|~~ hello ~~|');
  });

  it('printValue refuses a Function value — invariant', () => {
    // Function values have no grammatical literal. Surfacing one in
    // pipeValue means a host-binding ceremony skipped the descriptor
    // Map wrapper; printValue fires the invariant so the leak site
    // gets named and fixed rather than silently emitting a keyword-
    // shaped string that round-trips to the wrong value-class.
    const fn = makeFn('myOperand', 1, async (state) => state, {
      category: 'test', subject: 'any', modifiers: [],
      returns: 'any', docs: [], examples: [], throws: []
    });
    expect(() => printValue(fn)).toThrow(FunctionValueLeakedToPrintError);
  });

  it('renders a tagged-instance Map as ::Tag[payload…] — round-trip TaggedLit literal', async () => {
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['qlang/kind', makeTagKeyword('Box')],
      ['qlang/payload', [42, 'inner']]
    ]);
    expect(printValue(instance)).toBe('::Box[42 "inner"]');
  });

  it('renders an empty-payload tagged-instance as ::Tag[]', async () => {
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['qlang/kind', makeTagKeyword('Marker')],
      ['qlang/payload', []]
    ]);
    expect(printValue(instance)).toBe('::Marker[]');
  });
});

describe('printErrorValue — head + payload-filter branches', () => {
  it('an error with no :thrown prints in plain !{…} form (no tag-head prefix)', async () => {
    const { makeErrorValue } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([['kind', { type: 'keyword', name: 'oops', literal: ':oops' }]]));
    expect(printValue(err)).toBe('!{:kind :oops}');
  });

  it('an error with no :thrown keeps :message in the payload (user data, not template-fill)', async () => {
    // Without a TagKeyword `:thrown`, the printer has no class
    // identity to point hypertext docs at — `:message` is therefore
    // user-provided content, not a derivable template-fill, and
    // stays in the printed form.
    const { makeErrorValue } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([
      ['kind', { type: 'keyword', name: 'oops', literal: ':oops' }],
      ['message', 'something broke']
    ]));
    expect(printValue(err)).toBe('!{:kind :oops :message "something broke"}');
  });

  it('an empty error descriptor (only auto-injected :trail null) renders as !{}', async () => {
    const { makeErrorValue } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map());
    expect(printValue(err)).toBe('!{}');
  });

  it('a tag-headed error with only :qlang/kind survives the payload filter as ::Tag!{}', async () => {
    const { makeErrorValue, makeTagKeyword } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([['qlang/kind', makeTagKeyword('Foo')]]));
    expect(printValue(err)).toBe('::Foo!{}');
  });

  it('a tag-headed error renders the payload after the head, suppressing :qlang/kind duplication', async () => {
    const { makeErrorValue, makeTagKeyword } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([
      ['qlang/kind', makeTagKeyword('Foo')],
      ['kind', { type: 'keyword', name: 'oops', literal: ':oops' }]
    ]));
    expect(printValue(err)).toBe('::Foo!{:kind :oops}');
  });

  it('a tag-headed error elides :message (template-fill reachable via ::Tag | docs)', async () => {
    const { makeErrorValue, makeTagKeyword } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([
      ['qlang/kind', makeTagKeyword('Foo')],
      ['message', 'template-derivable prose'],
      ['kind', { type: 'keyword', name: 'oops', literal: ':oops' }]
    ]));
    expect(printValue(err)).toBe('::Foo!{:kind :oops}');
  });
});

describe('renderTaggedInstanceInline — table cell handler', () => {
  it('a tagged-instance in cell position round-trips through ::Tag[payload…]', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['qlang/kind', makeTagKeyword('Box')],
      ['qlang/payload', [42]]
    ]);
    const row = new Map([['boxed', instance]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('::Box[42]');
  });

  it('a tagged-instance with Number payload renders as ::Tag(42) — ParenGroup wrap branch', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['qlang/kind', makeTagKeyword('Count')],
      ['qlang/payload', 42]
    ]);
    const row = new Map([['c', instance]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('::Count(42)');
  });

  it('a tagged-instance inside a Vec cell — inline handler fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['qlang/kind', makeTagKeyword('Pair')],
      ['qlang/payload', [1, 2]]
    ]);
    const row = new Map([['pairs', [instance]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('::Pair[1 2]');
  });
});

describe('toPlain refuses a Function value — same invariant', () => {
  it('throws FunctionValueLeakedToPrintError when a function-value surfaces', () => {
    const fn = makeFn('myExotic', 1, async (state) => state, {
      category: 'test', subject: 'any', modifiers: [],
      returns: 'any', docs: [], examples: [], throws: []
    });
    expect(() => toPlain(fn)).toThrow(FunctionValueLeakedToPrintError);
  });
});

describe('table — Conduit / Snapshot / Function inside row Maps', () => {
  // table renders Vec of Maps via CELL_HANDLERS. Conduit / Snapshot /
  // Function values in cell positions reach the dispatch only when a
  // user explicitly piped them in (e.g. `env | /name | wrap-in-Map |
  // table`). Tests build the Vec directly so the cell handlers fire.
  it('renders a Conduit-valued cell as ~{::conduit[:name [] }body~{]}', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const bodyAst = { type: 'NumberLit', value: 99, text: '99' };
    const conduit = makeConduit(bodyAst, { name: 'ninetyNine', params: [] });
    const row = new Map([['fn', conduit]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('::conduit[:ninetyNine [] ~{99}]');
  });

  it('renders a Snapshot-valued cell as the unwrapped value (round-trip-safe)', async () => {
    // Snapshot is an immutable value-wrapper — the cell renderer
    // recurses on the captured value because that value carries
    // the renderable identity. The `as(:name)` surface form is a
    // binding statement, not a value literal; emitting it would
    // round-trip through parse + eval into env-write + identity
    // pipeValue, not back into a Snapshot value.
    const { table } = await import('../../src/runtime/format.mjs');
    const snap = makeSnapshot(42, { name: 'cached' });
    const row = new Map([['snap', snap]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('42');
    expect(rendered.pipeValue).not.toContain('as(:cached)');
  });

  it('table refuses a Function-valued cell — invariant fires through renderCell', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const fn = makeFn('myFn', 1, async (state) => state, {
      category: 'test', subject: 'any', modifiers: [],
      returns: 'any', docs: [], examples: [], throws: []
    });
    const row = new Map([['op', fn]]);
    await expect(table.fn(
      { pipeValue: [row], env: new Map() },
      []
    )).rejects.toThrow(FunctionValueLeakedToPrintError);
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
    expect(rendered.pipeValue).toContain('::conduit[:inner [] ~{7}]');
  });

  it('renders a Vec-of-Snapshot cell — INLINE handler recurses on unwrapped value', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const snap = makeSnapshot('hi', { name: 'greet' });
    const row = new Map([['snaps', [snap]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    // Inline-form recurses on the wrapped String "hi", which
    // round-trips through `escapeQlangStringLiteral` to `"hi"`.
    expect(rendered.pipeValue).toContain('"hi"');
    expect(rendered.pipeValue).not.toContain('as(:greet)');
  });

  it('table refuses a Vec-of-Function cell — invariant fires through renderInline', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const fn = makeFn('inlineFn', 1, async (state) => state, {
      category: 'test', subject: 'any', modifiers: [],
      returns: 'any', docs: [], examples: [], throws: []
    });
    const row = new Map([['fns', [fn]]]);
    await expect(table.fn(
      { pipeValue: [row], env: new Map() },
      []
    )).rejects.toThrow(FunctionValueLeakedToPrintError);
  });

  it('renders a Vec-of-Quote cell — INLINE handler for Quote fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeQuote } = await import('../../src/types.mjs');
    const row = new Map([['q', [makeQuote('mul(2)')]]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('~{mul(2)}');
  });

  it('renders a Quote-valued cell — CELL_HANDLERS.Quote fires', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeQuote } = await import('../../src/types.mjs');
    const row = new Map([['q', makeQuote('add(1)')]]);
    const rendered = await table.fn(
      { pipeValue: [row], env: new Map() },
      []
    );
    expect(rendered.pipeValue).toContain('~{add(1)}');
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

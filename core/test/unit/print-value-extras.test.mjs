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
      ['kind', makeTagKeyword('Box')],
      ['payload', [42, 'inner']]
    ]);
    expect(printValue(instance)).toBe('::Box[42 "inner"]');
  });

  it('renders an empty-payload tagged-instance as ::Tag[]', async () => {
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['kind', makeTagKeyword('Marker')],
      ['payload', []]
    ]);
    expect(printValue(instance)).toBe('::Marker[]');
  });
});

describe('printErrorValue — head + payload-filter branches', () => {
  it('an error with no :kind prints in plain !{…} form (no tag-head prefix)', async () => {
    const { makeErrorValue } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([['kind', { type: 'keyword', name: 'oops', literal: ':oops' }]]));
    expect(printValue(err)).toBe('!{:kind :oops}');
  });

  it('an error with no :kind keeps :message in the payload (user data, not template-fill)', async () => {
    // Without a TagKeyword `:kind`, the printer has no class
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

  it('a tag-headed error with only :kind survives the payload filter as ::Tag!{}', async () => {
    const { makeErrorValue, makeTagKeyword } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([['kind', makeTagKeyword('Foo')]]));
    expect(printValue(err)).toBe('::Foo!{}');
  });

  it('a tag-headed error renders the payload after the head, suppressing :kind duplication', async () => {
    const { makeErrorValue, makeTagKeyword } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([
      ['kind', makeTagKeyword('Foo')],
      ['category', { type: 'keyword', name: 'oops', literal: ':oops' }]
    ]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
  });

  it('a tag-headed error elides :message (template-fill reachable via ::Tag | docs)', async () => {
    const { makeErrorValue, makeTagKeyword } = await import('../../src/types.mjs');
    const err = makeErrorValue(new Map([
      ['kind', makeTagKeyword('Foo')],
      ['message', 'template-derivable prose'],
      ['category', { type: 'keyword', name: 'oops', literal: ':oops' }]
    ]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
  });
});

describe('renderTaggedInstanceInline — table cell handler', () => {
  it('a tagged-instance in cell position round-trips through ::Tag[payload…]', async () => {
    const { table } = await import('../../src/runtime/format.mjs');
    const { makeTagKeyword } = await import('../../src/types.mjs');
    const instance = new Map([
      ['kind', makeTagKeyword('Box')],
      ['payload', [42]]
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
      ['kind', makeTagKeyword('Count')],
      ['payload', 42]
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
      ['kind', makeTagKeyword('Pair')],
      ['payload', [1, 2]]
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

describe('runtime/format.mjs structural — table layout and json round-trips', () => {
  it('table renders headers and rows', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const tableOutput = await evalQuery('[{:name "Alice" :age 30} {:name "Bob" :age 25}] | table');
    expect(tableOutput).toContain('name');
    expect(tableOutput).toContain('age');
    expect(tableOutput).toContain('Alice');
    expect(tableOutput).toContain('Bob');
    expect(tableOutput).toContain('30');
    expect(tableOutput).toContain('25');
    expect(tableOutput.split('\n').length).toBeGreaterThan(4);
  });

  it('table aligns columns of varying widths', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const tableOutput = await evalQuery('[{:short "a" :long "longerValue"} {:short "bbb" :long "x"}] | table');
    expect(tableOutput).toContain('longerValue');
    expect(tableOutput).toContain('bbb');
  });

  it('table tolerates missing fields', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    const tableOutput = await evalQuery('[{:a 1} {:b 2}] | table');
    expect(tableOutput).toContain('a');
    expect(tableOutput).toContain('b');
  });

  it('table renders composite cells as inline qlang literals', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    // Map-valued cell: :loc is a nested Map with three keys.
    // Expected form `{:file "f.java" :line 12 :ok true}` — inline,
    // nested String quoted, no multi-line break, no [object Object].
    const mapCell = await evalQuery(
      '[{:loc {:file "f.java" :line 12 :ok true}}] | table');
    expect(mapCell).toContain('{:file "f.java" :line 12 :ok true}');
    expect(mapCell).not.toContain('[object Object]');
    // Vec-valued cell: rendered as a qlang Vec literal inline.
    const vecCell = await evalQuery('[{:tags [1 2 3]}] | table');
    expect(vecCell).toContain('[1 2 3]');
    // Set-valued cell — insertion order preserved by the Set literal.
    const setCell = await evalQuery('[{:tags #{:a :b}}] | table');
    expect(setCell).toContain('#{:a :b}');
    // Error-valued cell: !{…} wrapped descriptor inline. The
    // runtime materializes an error descriptor with `:trail null`
    // when no success-track combinator has deflected past the
    // fault, so the rendered cell reflects that shape verbatim
    // rather than the source literal.
    const errCell = await evalQuery('[{:err !{:kind :oops}}] | table');
    expect(errCell).toContain('!{:kind :oops :trail null}');
    // Null cell renders as an empty column, not the string "null".
    const nullCell = await evalQuery('[{:a 1 :b null} {:a 2 :b 3}] | table');
    const nullCellRow = nullCell.split('\n').find(l => l.includes('| 1 '));
    expect(nullCellRow).toMatch(/\|\s+\|$/);
  });

  it('table renders scalar cells bare: Boolean, Keyword, null-in-Vec', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    // Top-level Boolean and Keyword cells — bare, without quotes.
    const boolCell = await evalQuery('[{:ok true} {:ok false}] | table');
    expect(boolCell).toContain('| true  |');
    expect(boolCell).toContain('| false |');
    const kwCell = await evalQuery('[{:status :ready}] | table');
    expect(kwCell).toContain('| :ready |');
    // Null nested inside a composite — INLINE_HANDLERS.Null emits
    // the literal `null` (distinct from a null cell, which is bare).
    const nullInVec = await evalQuery('[{:tags [null 1]}] | table');
    expect(nullInVec).toContain('[null 1]');
  });

  it('table unquotes top-level String cells but quotes nested Strings', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    // Top-level :name is a String — printed bare inside the cell.
    // Inside a composite :tags cell the same String is quoted per
    // qlang-literal convention.
    const out = await evalQuery('[{:name "Alice" :tags ["x" "y"]}] | table');
    expect(out).toMatch(/\| Alice\s+\|/);
    expect(out).toContain('["x" "y"]');
  });

  it('json roundtrips Set as array', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#{1 2 3} | json')).toMatch(/^\[/);
  });

  it('json roundtrips keyword as colon-prefixed string', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery(':foo | json')).toBe('":foo"');
  });

  it('json roundtrips Boolean as JSON boolean', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('true | json')).toBe('true');
    expect(await evalQuery('false | json')).toBe('false');
  });
});

describe('format.fromPlain — inverse of toPlain', async () => {
  // `fromPlain` lifts a JSON-parsed plain JS value back into qlang:
  // plain object → Map keyed by interned keywords; plain array →
  // Vec; scalars pass through. Used by `parseJson` and by the CLI
  // script-mode auto-pipe of stdin.

  it('scalar values pass through unchanged', async () => {
    const { fromPlain } = await import('../../src/runtime/format.mjs');
    expect(fromPlain(42)).toBe(42);
    expect(fromPlain('hi')).toBe('hi');
    expect(fromPlain(true)).toBe(true);
    expect(fromPlain(null)).toBe(null);
  });

  it('arrays lift into Vec (plain JS array) elementwise', async () => {
    const { fromPlain } = await import('../../src/runtime/format.mjs');
    const lifted = fromPlain([1, 'two', true]);
    expect(lifted).toEqual([1, 'two', true]);
  });

  it('objects lift into Map keyed by interned keywords', async () => {
    const { fromPlain } = await import('../../src/runtime/format.mjs');
    const { isQMap } = await import('../../src/types.mjs');
    const lifted = fromPlain({ a: 1, b: 2 });
    expect(isQMap(lifted)).toBe(true);
    expect(lifted.get('a')).toBe(1);
    expect(lifted.get('b')).toBe(2);
  });

  it('round-trips nested plain JSON through toPlain and back', async () => {
    const { fromPlain, toPlain } = await import('../../src/runtime/format.mjs');
    const plain = { user: { name: 'alice', tags: ['admin', 'dev'] } };
    const roundtrip = toPlain(fromPlain(plain));
    expect(roundtrip).toEqual(plain);
  });
});

describe('format.toPlain unwraps Snapshot transparently', () => {
  it('toPlain on a Snapshot lifts the captured payload through the codec', () => {
    expect(toPlain(makeSnapshot(42, { name: 'answer' }))).toBe(42);
    const innerMap = new Map([['k', 'v']]);
    expect(toPlain(makeSnapshot(innerMap, { name: 'wrap' }))).toEqual({ k: 'v' });
  });
});

describe('format.toPlain non-keyword Map keys', async () => {
  it('json on a Map with string (non-keyword) keys uses String(k) fallback', async () => {
    // Inject a Map whose keys are plain strings, not interned keywords.
    // Construct via session.bind so we bypass the parser's
    // keyword-only Map literal syntax.
    const { createSession } = await import('../../src/session.mjs');
    const s = await createSession();
    const map = new Map();
    map.set('rawKey', 'rawValue');
    s.bind('rawMap', map);
    const out = (await s.evalCell('rawMap | json')).result;
    expect(typeof out).toBe('string');
    expect(out).toContain('rawKey');
    expect(out).toContain('rawValue');
  });

  it('table on a Vec of Maps with non-keyword keys still renders', async () => {
    const { createSession } = await import('../../src/session.mjs');
    const s = await createSession();
    const row = new Map();
    row.set('rawCol', 'rawCell');
    s.bind('rows', [row]);
    const out = (await s.evalCell('rows | table')).result;
    expect(typeof out).toBe('string');
    expect(out).toContain('rawCol');
    expect(out).toContain('rawCell');
  });
});

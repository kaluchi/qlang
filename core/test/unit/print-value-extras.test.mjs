// Unit coverage for printValue branches that fire only when a
// Conduit / Snapshot / Function value lands in pipeValue — paths
// reachable via `env | /name` ceremony (env-walk drops the descriptor
// Map directly into pipeValue) but not exercised by ordinary pipeline
// execution. Tests build the values directly and call printValue.

import { describe, it, expect } from 'vitest';
import { printValue, toPlain, fromPlain } from '../../src/runtime/format.mjs';
import {
  makeConduit,
  makeSnapshot,
  makeDoc,
  keyword,
  makeTagKeyword,
  makeErrorValue,
  isConduit,
  isSnapshot,
  isDoc,
  isQMap,
  FunctionValueLeakedToPrintError
} from '../../src/types.mjs';
import { parse } from '../../src/parse.mjs';
import { makeFn } from '../../src/rule10.mjs';

describe('printValue — Conduit / Snapshot / Function branches', () => {
  it('renders a zero-arity named Conduit as `::conduit[:name [] ~(body)]`', () => {
    const bodyAst = { type: 'NumberLit', value: 42, text: '42' };
    const conduit = makeConduit(bodyAst, { name: 'answer', params: [] });
    expect(isConduit(conduit)).toBe(true);
    expect(printValue(conduit)).toBe('::conduit[:answer [] ~(42)]');
  });

  it('renders a parametric named Conduit with [:params] in declaration order', () => {
    const conduit = makeConduit(parse('add x y'), { name: 'sum2', params: ['x', 'y'] });
    expect(printValue(conduit)).toBe('::conduit[:sum2 [:x :y] ~(add x y)]');
  });

  it('docs do not appear in value-literal — they are declaration metadata, reachable via the `:name | docs` axis', () => {
    const bodyAst = { type: 'NumberLit', value: 7, text: '7' };
    const conduit = makeConduit(bodyAst, {
      name: 'lucky',
      params: [],
      docs: [' first remark ', ' second remark ']
    });
    expect(printValue(conduit)).toBe('::conduit[:lucky [] ~(7)]');
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
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const instance = makeTaggedInstance(makeTagKeyword('Box'), [42, 'inner']);
    expect(printValue(instance)).toBe('::Box[42 "inner"]');
  });

  it('renders an empty-payload tagged-instance as ::Tag[]', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const instance = makeTaggedInstance(makeTagKeyword('Marker'), []);
    expect(printValue(instance)).toBe('::Marker[]');
  });
});

describe('printErrorValue — head + payload-filter branches', () => {
  it('default ::Error tag heads an otherwise-empty error', async () => {
    // Every error carries an identity tag on the JS-header `tag`
    // slot — `::Error` is the universal default for user `!{}`
    // without explicit `:kind ::Foo`. The printer emits the tag
    // unconditionally so the round-trip recovers the same
    // identity.
    const err = makeErrorValue(makeTagKeyword('Error'), new Map());
    expect(printValue(err)).toBe('::Error!{}');
  });

  it('descriptor fields ride after the tag head', async () => {
    const err = makeErrorValue(makeTagKeyword('Error'), new Map([
      ['message', 'something broke']
    ]));
    expect(printValue(err)).toBe('::Error!{:message "something broke"}');
  });

  it('descriptor with non-TagKeyword :kind keeps the field verbatim under the default ::Error head', async () => {
    // The runtime treats `:kind` only as an identity slot when its
    // value is a TagKeyword. A plain-keyword `:kind` stays in the
    // descriptor as ordinary user data — the universal `::Error`
    // tag still appears at the head.
    const err = makeErrorValue(makeTagKeyword('Error'), new Map([
      ['kind', keyword('oops')]
    ]));
    expect(printValue(err)).toBe('::Error!{:kind :oops}');
  });

  it('an empty user-defined tag-headed error renders as ::Foo!{}', async () => {
    const err = makeErrorValue(makeTagKeyword('Foo'), new Map());
    expect(printValue(err)).toBe('::Foo!{}');
  });

  it('a tag-headed error renders the payload after the head', async () => {
    const err = makeErrorValue(makeTagKeyword('Foo'), new Map([
      ['category', keyword('oops')]
    ]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
  });

  it(':message rides through the printer verbatim — user content, not template-fill', async () => {
    // User-stamped `:message` fields ride through the printer
    // verbatim so round-trip preserves them exactly. Runtime-
    // side errors (`errorFromQlang`) simply omit `:message` from
    // the descriptor at construction.
    const err = makeErrorValue(makeTagKeyword('Foo'), new Map([
      ['message', 'user-stamped prose'],
      ['category', keyword('oops')]
    ]));
    expect(printValue(err)).toBe('::Foo!{:message "user-stamped prose" :category :oops}');
  });
});

describe('toPlain encodes every TaggedInstance shape through the $tag envelope', () => {
  it('Set / Map / wrap-object payload shapes each encode their inner data plane', async () => {
    // The TaggedInstance `toPlain` handler routes by payload
    // shape — a tag over a set, a Map and an opaque wrap-object are
    // exercised here; the Array branch is covered through the
    // earlier `Box[42]` test.
    const { makeTaggedInstance, makeTagKeyword: makeTag, makeSet } = await import('../../src/types.mjs');
    const taggedSet = makeTaggedInstance(makeTag('Keys'), makeSet([2, 1]));
    const plainSet = toPlain(taggedSet);
    expect(plainSet.$tag).toBe('Keys');
    expect(plainSet.payload).toEqual([1, 2]);
    const taggedMap = makeTaggedInstance(makeTag('User'), new Map([['name', 'alice']]));
    const plainMap = toPlain(taggedMap);
    expect(plainMap.$tag).toBe('User');
    expect(plainMap.payload).toEqual({ name: 'alice' });
    const taggedStr = makeTaggedInstance(makeTag('Note'), 'hello');
    const plainStr = toPlain(taggedStr);
    expect(plainStr.$tag).toBe('Note');
    expect(plainStr.payload).toBe('hello');
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

describe('runtime/format.mjs structural — json round-trips', () => {
  it('json roundtrips Set as array', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('#[1 2 3] | json')).toMatch(/^\[/);
  });

  it('json writes a keyword as its bare name', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery(':foo | json')).toBe('"foo"');
  });

  it('json roundtrips Boolean as JSON boolean', async () => {
    const { evalQuery } = await import('../../src/eval.mjs');
    expect(await evalQuery('true | json')).toBe('true');
    expect(await evalQuery('false | json')).toBe('false');
  });
});

describe('format.fromPlain — inverse of toPlain', () => {
  // `fromPlain` lifts a JSON-parsed plain JS value back into qlang:
  // plain object → Map keyed by interned keywords; plain array →
  // Vec; scalars pass through. Used by `parseJson` and by the CLI
  // script-mode auto-pipe of stdin.

  it('scalar values pass through unchanged', async () => {
    expect(fromPlain(42)).toBe(42);
    expect(fromPlain('hi')).toBe('hi');
    expect(fromPlain(true)).toBe(true);
    expect(fromPlain(null)).toBe(null);
  });

  it('arrays lift into Vec (plain JS array) elementwise', async () => {
    const lifted = fromPlain([1, 'two', true]);
    expect(lifted).toEqual([1, 'two', true]);
  });

  it('objects lift into Map keyed by interned keywords', async () => {
    const lifted = fromPlain({ a: 1, b: 2 });
    expect(isQMap(lifted)).toBe(true);
    expect(lifted.get('a')).toBe(1);
    expect(lifted.get('b')).toBe(2);
  });

  it('round-trips nested plain JSON through toPlain and back', async () => {
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

describe('format.toPlain non-keyword Map keys', () => {
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

});

describe('the finite-double domain holds at every render seam', () => {
  // Source cannot mint an infinity or a NaN — the parser refuses the
  // literal and every arithmetic site lifts a numericDomain error.
  // A host can, through `session.bind` or a locator's `impls` map,
  // and render is where such a value becomes observable: `printValue`
  // would answer `Infinity`, which no production reads back, and the
  // JSON boundary would answer `null`.
  it('printValue refuses an infinity and a NaN', async () => {
    const { NumberNotFiniteLeakedToPrintError } = await import('../../src/types.mjs');
    for (const leaked of [Infinity, -Infinity, NaN]) {
      let thrown = null;
      try { printValue(leaked); } catch (caught) { thrown = caught; }
      expect(thrown).toBeInstanceOf(NumberNotFiniteLeakedToPrintError);
      expect(thrown.name).toBe('NumberNotFiniteLeakedToPrintError');
      expect(thrown.context.actualValue).toBe(String(leaked));
    }
  });

  it('toPlain and toTaggedJSON refuse the same values', async () => {
    const { NumberNotFiniteLeakedToPrintError } = await import('../../src/types.mjs');
    const { toTaggedJSON } = await import('../../src/codec.mjs');
    expect(() => toPlain(Infinity)).toThrow(NumberNotFiniteLeakedToPrintError);
    expect(() => toTaggedJSON(NaN)).toThrow(NumberNotFiniteLeakedToPrintError);
  });

  it('every in-domain magnitude renders unchanged', () => {
    expect(printValue(1e308)).toBe('1e+308');
    expect(printValue(-1e308)).toBe('-1e+308');
    expect(toPlain(0.1)).toBe(0.1);
  });
});

// The print and the JSON of the values the printer meets at its edges: a
// binding record, a doc, a value under a tag, an error and its facts, the
// doubles at their bounds, the print a kind declares, and the scope `env`
// answers, which the parser reads back.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { parse } from '../../src/parse.mjs';
import { createSession } from '../../src/session.mjs';
import { printValue, toPlain, fromPlain } from '../../src/runtime/format.mjs';
import {
  makeBinding,
  makeDoc,
  keyword,
  makeTag,
  makeErrorValue,
  isDoc,
  isQMap
} from '../../src/types.mjs';

describe('printValue — binding record / Function branches', () => {
  it('renders a binding record as the tagged Map it is', () => {
    const record = makeBinding({ name: keyword('nums'), value: [1, 2, 3] });
    expect(printValue(record)).toBe(
      '::binding{\n  :name :nums\n  :docs []\n  :value [1 2 3]\n  :source null\n  :origin null\n}');
  });

  it('renders a Doc value as `|~~content~~|` block form', () => {
    const doc = makeDoc(' hello ');
    expect(isDoc(doc)).toBe(true);
    expect(printValue(doc)).toBe('|~~ hello ~~|');
  });

  it('renders a tagged-instance Map as ::Tag[payload…] — round-trip TaggedLit literal', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const instance = makeTaggedInstance(makeTag('Box'), [42, 'inner']);
    expect(printValue(instance)).toBe('::Box[42 "inner"]');
  });

  it('renders an empty-payload tagged-instance as ::Tag[]', async () => {
    const { makeTaggedInstance } = await import('../../src/types.mjs');
    const instance = makeTaggedInstance(makeTag('Marker'), []);
    expect(printValue(instance)).toBe('::Marker[]');
  });
});

describe('printErrorValue — head + payload-filter branches', () => {
  it('an error of the kind of errors prints without its kind', async () => {
    // Every error carries an identity tag on the JS-header `tag`
    // slot — `::error`, the kind of errors, for user `!{}` with no tag
    // before its bang. The brackets imply that kind, so the
    // printer leaves it out, as it does a vector's, and the
    // round-trip recovers the same identity [D32], [D64].
    const err = makeErrorValue(makeTag('error'), new Map());
    expect(printValue(err)).toBe('!{\n  :trail []\n} | raise');
  });

  it('a failure that flew no step prints its empty path, so its print reads back as itself [D210]', async () => {
    const err = makeErrorValue(makeTag('Foo'), new Map([['category', keyword('oops')]]));
    expect(printValue(err)).toBe('::Foo!{\n  :category :oops\n  :trail []\n} | raise');
    expect(deepEqual(await evalQuery(printValue(err)), err)).toBe(true);
  });

  it('a :kind in the descriptor is a fact like any other', async () => {
    // A `:kind` names no tag [D190]: it stays in the descriptor as
    // ordinary user data, the error staying of the kind of errors.
    const err = makeErrorValue(makeTag('error'), new Map([
      ['kind', keyword('oops')]
    ]));
    expect(printValue(err)).toBe('!{\n  :kind :oops\n  :trail []\n} | raise');
  });

  it(':message rides through the printer verbatim — user content, not template-fill', async () => {
    // User-stamped `:message` fields ride through the printer
    // verbatim so round-trip preserves them exactly. Runtime-
    // side errors (`errorFromQlang`) simply omit `:message` from
    // the descriptor at construction.
    const err = makeErrorValue(makeTag('Foo'), new Map([
      ['message', 'user-stamped prose'],
      ['category', keyword('oops')]
    ]));
    expect(printValue(err)).toBe('::Foo!{\n  :message "user-stamped prose"\n  :category :oops\n  :trail []\n} | raise');
  });
});

describe('toPlain encodes a failure', () => {
  it('as the object of its $error, its tag and its facts [D192]', async () => {
    const plain = toPlain(await evalQuery('"x" | add 1'));
    expect(Object.keys(plain)).toEqual(['$error']);
    expect(plain.$error.$tag).toBe('number/add/SubjectNotNumberError');
    expect(plain.$error.facts.actualType).toBe('::string');
  });
});

describe('toPlain encodes every TaggedInstance shape through the $tag envelope', () => {
  it('Set / Map / wrap-object payload shapes each encode their inner data plane', async () => {
    // The TaggedInstance `toPlain` handler routes by payload
    // shape — a tag over a set, a Map and an opaque wrap-object are
    // exercised here; the Array branch is covered through the
    // earlier `Box[42]` test.
    const { makeTaggedInstance, makeTag: makeTag, makeSet } = await import('../../src/types.mjs');
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

describe('format.toPlain carries a binding record as a tagged Map', () => {
  it('toPlain on a binding record keeps its tag and its fields', () => {
    const plain = toPlain(makeBinding({ name: keyword('answer'), value: 42 }));
    expect(plain.$tag).toBe('binding');
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
  // A host can, through `session.bind` or the `impls` of its sources,
  // and render is where such a value becomes observable: `printValue`
  // would answer `Infinity`, which no production reads back, and the
  // JSON boundary would answer `null`.
  it('printValue refuses an infinity and a NaN', async () => {
    const { BuiltinNumberNotFiniteLeakedToPrintError } = await import('../../src/types.mjs');
    for (const leaked of [Infinity, -Infinity, NaN]) {
      let thrown = null;
      try { printValue(leaked); } catch (caught) { thrown = caught; }
      expect(thrown).toBeInstanceOf(BuiltinNumberNotFiniteLeakedToPrintError);
      expect(thrown.name).toBe('NumberNotFiniteLeakedToPrintError');
      expect(thrown.facts.actualValue).toBe(String(leaked));
    }
  });

  it('toPlain refuses the values the printer refuses', async () => {
    const { BuiltinNumberNotFiniteLeakedToPrintError } = await import('../../src/types.mjs');
    expect(() => toPlain(Infinity)).toThrow(BuiltinNumberNotFiniteLeakedToPrintError);
  });

  it('every in-domain magnitude renders unchanged', () => {
    expect(printValue(1e308)).toBe('1e+308');
    expect(printValue(-1e308)).toBe('-1e+308');
    expect(toPlain(0.1)).toBe(0.1);
  });
});

// A kind whose `print` is declared under it prints its parts through it,
// and the forms of the core print the rest of the value [D96].
describe('print — the print declared under a kind', () => {
  const BADGE_SOURCE = [
    ':badge |~~ A badge. ~~|',
    ':badge/print',
    '  |~~ A badge as its name. ~~|',
    '  ~(:returns ::string | /name)'
  ].join('\n');

  async function badgeSession() {
    const { createSession } = await import('../../src/session.mjs');
    return await createSession({ sources: [{ uri: 'badge', source: BADGE_SOURCE }] });
  }

  it('takes the print of a part from the kind of that part', async () => {
    const session = await badgeSession();
    const printed = await session.evalCell('[::badge{:name "ok"} {:k ::badge{:name "no"}} 1] | print');
    expect(printed.result).toBe('[\n  ok\n  {\n    :k no\n  }\n  1\n]');
  });

  it('reaches a part inside an error at rest and under a tag over a scalar', async () => {
    const session = await badgeSession();
    const inError = await session.evalCell('[::error{:k ::badge{:name "in"}}] | print');
    expect(inError.result).toContain(':k in');
    const underTag = await session.evalCell(':Box |~~ a box ~~| | [::Box(5) :kw] | print');
    expect(underTag.result).toBe('[::Box(5) :kw]');
  });

  it('prints what a kind answers that is no string as the value it is', async () => {
    const session = await badgeSession();
    const printed = await session.evalCell('[(5 | tag ::badge)] | print');
    expect(printed.result).toContain('::proj/SubjectNotProjectableError!{');
  });
});

describe('the print of env reads back', () => {
  it('prints a literal the parser reads, and no source of a function', async () => {
    const printed = printValue(await evalQuery(':f ~(add 1) | :v 5 | :T |~~ A kind. ~~| | env'));
    expect(printed).toContain('::binding{');
    expect(() => parse(printed, { uri: 'env-round-trip' })).not.toThrow();
    expect(printed).not.toMatch(/async function\b/);
    expect(printed).not.toMatch(/=>\s*\{/);
  });

  it('prints a function a host binds as a string that marks it', async () => {
    const session = await createSession();
    session.bind('myHostFn', async function helloFn() { return 42; });
    const printed = printValue((await session.evalCell('env')).result);
    expect(printed).toContain('"<host-fn helloFn>"');
    expect(() => parse(printed, { uri: 'host-fn-round-trip' })).not.toThrow();
  });

  it('writes the JSON of a tag name and of a host function as strings', async () => {
    const session = await createSession();
    session.bind('hostFn', async function helloFn() { return 42; });
    session.bind('kindName', makeTag('Foo'));
    const parsed = JSON.parse((await session.evalCell('env | json')).result);
    expect(parsed.hostFn.payload.value).toMatch(/^<host-fn [A-Za-z]+>$/);
    expect(parsed.kindName.payload.value).toBe('::Foo');
  });
});

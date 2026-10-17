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
  isMap,
  isErrorValue
} from '../../src/types.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printAnswer, caretOf } from '../../src/runtime/print.mjs';

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

  it('renders a vector under a tag as ::Tag[payload…] — round-trip TaggedLit literal', async () => {
    const { makeTagged } = await import('../../src/types.mjs');
    const tagged = makeTagged(makeTag('Box'), [42, 'inner']);
    expect(printValue(tagged)).toBe('::Box[42 "inner"]');
  });

  it('renders a tag over an empty vector as ::Tag[]', async () => {
    const { makeTagged } = await import('../../src/types.mjs');
    const tagged = makeTagged(makeTag('Marker'), []);
    expect(printValue(tagged)).toBe('::Marker[]');
  });
});

describe('printErrorValue — head + payload-filter branches', () => {
  it('an error of the kind of errors prints without its kind', async () => {
    // Every error carries an identity tag on the JS-header `tag`
    // slot — `::error`, the kind of errors, for user `!{}` with no tag
    // before its bang. The brackets imply that kind, so the
    // printer leaves it out, as it does a vector's, and the
    // round-trip recovers the same identity [QSLIT#kind], [QSERR#rest].
    const err = makeErrorValue(makeTag('error'), new Map());
    expect(printValue(err)).toBe('!{}');
  });

  it('a failure that flew no step prints its facts alone, and its print raised starts its trace at the raise [D359]', async () => {
    const err = makeErrorValue(makeTag('Foo'), new Map([['category', keyword('oops')]]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
    expect(isErrorValue(await evalQuery(printValue(err)))).toBe(false);
    expect(deepEqual(await evalQuery(`${printValue(err)} | raise !| trace | map ~failed`), await evalQuery('[~(raise)]'))).toBe(true);
  });

  it('an answer that is a failure prints under the line that says it was raised, an error at rest under none [QSERR#rest]', async () => {
    const env = await langRuntime();
    const failure = await evalQuery('"x" | add 1');
    expect(await printAnswer(failure, env)).toBe(`|~| raised, and no !| caught it\n${printValue(failure)}`);
    const atRest = await evalQuery('"x" | add 1 !| it');
    expect(await printAnswer(atRest, env)).toBe(printValue(atRest));
  });

  it('a :kind in the descriptor is a fact like any other', async () => {
    // A `:kind` names no tag [QSERR#rest]: it stays in the descriptor as
    // ordinary user data, the error staying of the kind of errors.
    const err = makeErrorValue(makeTag('error'), new Map([
      ['kind', keyword('oops')]
    ]));
    expect(printValue(err)).toBe('!{:kind :oops}');
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
    expect(printValue(err)).toBe('::Foo!{:message "user-stamped prose" :category :oops}');
  });
});

// The refusal of a text holds where the reading stopped as its span, and a
// host that prints for a person's eye draws the line and a caret under its
// column below the alert, two line comments a reading passes over [D360].
describe('caretOf — the caret under the line where the reading stopped [D360]', () => {
  const caretOfQuery = async query => caretOf(await evalQuery(query));
  const refusalAt = (source, span) => `::quote/ParseError!{:source ${JSON.stringify(source)} :location ::span[${span}]} | raise`;

  it('draws the line and a caret as wide as the span under its column', async () => {
    expect(await caretOfQuery('[mul(2) add(1)]')).toBe('|~| [mul(2) add(1)]\n|~|     ^~~');
  });

  it('draws one caret where the reading stopped at the end of the line', async () => {
    expect(await caretOfQuery('[1 2')).toBe('|~| [1 2\n|~|     ^');
    expect(await caretOfQuery(refusalAt('x', '1 1 2 1 1 2'))).toBe('|~| x\n|~|  ^');
  });

  it('draws the caret to the end of the line for a span that runs past it', async () => {
    expect(await caretOfQuery('[1 2 (3 | add 1)\n]')).toBe('|~| [1 2 (3 | add 1)\n|~| ^~~~~~~~~~~~~~~~');
    expect(await caretOfQuery(refusalAt('xyz', '1 1 2 1000000000 1 1000000000'))).toBe('|~| xyz\n|~|  ^~');
  });

  it('draws none for a column before the line or past its end', async () => {
    for (const span of ['0 0 0 0 0 0', '0 1 -3 0 1 2', '2 1 3 2 1 3', '0 1 1000000000 0 1 1000000000']) {
      expect(await caretOfQuery(refusalAt('x', span)), span).toBe(null);
    }
  });

  it('draws none for a source that is no line', async () => {
    expect(await caretOfQuery(refusalAt('a\nb', '0 1 1 1 1 2'))).toBe(null);
  });

  it('draws none for a failure of another kind that holds the same facts, nor for a value, the error at rest of a refusal of a text among them', async () => {
    expect(await caretOfQuery('!{:source "x" :location ::span[0 1 1 1 1 2]} | raise')).toBe(null);
    expect(await caretOfQuery('[1 2]')).toBe(null);
    expect(await caretOfQuery('"[1 2" | parse !| it')).toBe(null);
  });

  it('draws none for a refusal of a text that holds no line or no span', async () => {
    expect(await caretOfQuery('::quote/ParseError!{:location ::span[0 1 1 1 1 2]} | raise')).toBe(null);
    expect(await caretOfQuery('::quote/ParseError!{:source "x" :location 5} | raise')).toBe(null);
  });
});

describe('toPlain encodes a failure', () => {
  it('as the object of its $error, its tag and its facts [QSPRN#json]', async () => {
    const plain = toPlain(await evalQuery('"x" | add 1'));
    expect(Object.keys(plain)).toEqual(['$error']);
    expect(plain.$error.$tag).toBe('number/add/SubjectNotNumberError');
    expect(plain.$error.facts.actualType).toBe('::string');
  });
});

describe('toPlain encodes every shape of a value under a tag through the $tag envelope', () => {
  it('a tag over a set, a map and an atom writes its payload in JSON', async () => {
    // A tag over a vector is held by the earlier `Box[42]` test.
    const { makeTagged, makeTag: makeTag, makeSet } = await import('../../src/types.mjs');
    const taggedSet = makeTagged(makeTag('Keys'), makeSet([2, 1]));
    const plainSet = toPlain(taggedSet);
    expect(plainSet.$tag).toBe('Keys');
    expect(plainSet.payload).toEqual([1, 2]);
    const taggedMap = makeTagged(makeTag('User'), new Map([['name', 'alice']]));
    const plainMap = toPlain(taggedMap);
    expect(plainMap.$tag).toBe('User');
    expect(plainMap.payload).toEqual({ name: 'alice' });
    const taggedStr = makeTagged(makeTag('Note'), 'hello');
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
  // Vec; atoms pass through. Used by `parseJson` and by the CLI
  // script-mode auto-pipe of stdin.

  it('atoms pass through unchanged', async () => {
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
    expect(isMap(lifted)).toBe(true);
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
  // Source cannot make an infinity or a NaN: the parser refuses the
  // literal [QSLIT#number], and an answer past the doubles is refused as
  // `::number/NotFiniteError` [QSNUM#arithmetic].
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
// and the forms of the core print the rest of the value [QSPRN#print].
describe('print — the print declared under a kind', () => {
  const BADGE_SOURCE = [
    ':badge |~~ A badge. ~~|',
    ':badge/print',
    '  |~~ A badge as its name. ~~|',
    '  ~(:returns ::string | get /name)'
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

  it('reaches a part inside an error at rest and under a tag over an atom', async () => {
    const session = await badgeSession();
    const inError = await session.evalCell('[::error{:k ::badge{:name "in"}}] | print');
    expect(inError.result).toContain(':k in');
    const underTag = await session.evalCell(':Box |~~ a box ~~| | [::Box#5 :kw] | print');
    expect(underTag.result).toBe('[::Box#5 :kw]');
  });

  it('prints what a kind answers that is no string as the value it is', async () => {
    const session = await badgeSession();
    const printed = await session.evalCell('get [~(5 | tag ::badge)] | print');
    expect(printed.result).toContain('::path/SubjectHasNoPartsError!{');
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

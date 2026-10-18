// The print and the JSON of the values the printer meets at its edges: a
// binding record, a doc, a value under a tag, an error and its facts, the
// doubles at their bounds, the print a kind declares, and the scope `env`
// answers, which the parser reads back.

import { describe, it, expect } from 'vitest';
import { deepEqual } from '../../src/equality.mjs';
import { parse } from '../../src/parse.mjs';
import { createSession, evalQuery } from '../../src/session.mjs';
import { printValue } from '../../src/print-value.mjs';
import { toPlain, fromPlain } from '../../src/runtime/json.mjs';
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

  it('a failure that flew no step prints its facts alone, and its print raised starts its trace at the raise [QSERR#print]', async () => {
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
// column below the alert, two line comments a reading passes over [QSERR#print].
describe('caretOf — the caret under the line where the reading stopped [QSERR#print]', () => {
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

describe('toPlain encodes a tag over every kind of payload through the $tag envelope', () => {
  it('a tag over a set, a map and an atom writes its payload in JSON', async () => {
    // A tag over a vector is held by the earlier `Box[42]` test.
    const { makeTagged, makeTag: makeTag } = await import('../../src/types.mjs');
    const { makeSet } = await import('../../src/ordering.mjs');
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

describe('runtime/json.mjs structural — json round-trips', () => {
  it('json roundtrips Set as array', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('#[1 2 3] | json')).toMatch(/^\[/);
  });

  it('json writes a keyword as its bare name', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery(':foo | json')).toBe('"foo"');
  });

  it('json roundtrips Boolean as JSON boolean', async () => {
    const { evalQuery } = await import('../../src/session.mjs');
    expect(await evalQuery('true | json')).toBe('true');
    expect(await evalQuery('false | json')).toBe('false');
  });
});

describe('json.fromPlain — inverse of toPlain', () => {
  // `fromPlain` lifts a value of JavaScript parsed from JSON into qlang: an
  // object of JavaScript into a map keyed by its names, an array into a
  // vector, and an atom as it is [QSHST#source].

  it('atoms pass through unchanged', async () => {
    expect(fromPlain(42)).toBe(42);
    expect(fromPlain('hi')).toBe('hi');
    expect(fromPlain(true)).toBe(true);
    expect(fromPlain(null)).toBe(null);
  });

  it('an array of JavaScript lifts into a vector element by element', async () => {
    const lifted = fromPlain([1, 'two', true]);
    expect(lifted).toEqual([1, 'two', true]);
  });

  it('objects lift into Map keyed by interned keywords', async () => {
    const lifted = fromPlain({ a: 1, b: 2 });
    expect(isMap(lifted)).toBe(true);
    expect(lifted.get('a')).toBe(1);
    expect(lifted.get('b')).toBe(2);
  });

  it('round-trips nested data of JSON through toPlain and back', async () => {
    const plain = { user: { name: 'alice', tags: ['admin', 'dev'] } };
    const roundtrip = toPlain(fromPlain(plain));
    expect(roundtrip).toEqual(plain);
  });
});

describe('json.toPlain carries a binding record as a tagged Map', () => {
  it('toPlain on a binding record keeps its tag and its fields', () => {
    const plain = toPlain(makeBinding({ name: keyword('answer'), value: 42 }));
    expect(plain.$tag).toBe('binding');
  });
});

describe('json.toPlain writes the keys of a map a host hands', () => {
  it('json writes a map a host hands as the subject of a cell by its keys, each a string', async () => {
    const s = await createSession();
    const map = new Map();
    map.set('rawKey', 'rawValue');
    const out = (await s.evalCell('json', { initialPipeValue: map })).result;
    expect(out).toBe('{"rawKey":"rawValue"}');
  });
});

describe('the finite-double domain holds at every render seam', () => {
  // A number past the doubles has no literal [QSLIT#number], and an answer
  // brought under `::number` past them is refused as `::number/NotFiniteError`
  // [QSNUM#arithmetic]; a function of the reader that answers one from a
  // primitive of the core under no kind meets the printer and the codec of
  // JSON, which raise it where they write it [QSHST#source].
  it('printValue refuses an infinity and a NaN as values of no kind', async () => {
    const { BuiltinForeignValueError } = await import('../../src/types.mjs');
    for (const leaked of [Infinity, -Infinity, NaN]) {
      let thrown = null;
      try { printValue(leaked); } catch (caught) { thrown = caught; }
      expect(thrown).toBeInstanceOf(BuiltinForeignValueError);
      expect(thrown.name).toBe('ForeignValueError');
      expect(thrown.facts.actualValue).toBe(`number ${leaked}`);
    }
  });

  it('toPlain refuses the values the printer refuses', async () => {
    const { BuiltinForeignValueError } = await import('../../src/types.mjs');
    expect(() => toPlain(Infinity)).toThrow(BuiltinForeignValueError);
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

  it('never meets a function a host hands in a scope, which the session refuses as it takes the scope [QSHST#source]', async () => {
    const scope = new Map(await langRuntime()).set('hostFn', makeBinding({ name: keyword('hostFn'), value: async function helloFn() { return 42; } }));
    await expect(createSession({ scope })).rejects.toMatchObject({ address: 'builtin/ForeignValueError', facts: { actualValue: 'function helloFn' } });
  });

  it('writes the JSON of a tag name a host hands in a scope as its literal', async () => {
    const scope = new Map(await langRuntime()).set('kindName', makeBinding({ name: keyword('kindName'), value: makeTag('Foo') }));
    const session = await createSession({ scope });
    const parsed = JSON.parse((await session.evalCell('env | json')).result);
    expect(parsed.kindName.payload.value).toBe('::Foo');
  });
});

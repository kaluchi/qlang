// The print and the JSON of the values the printer meets at its edges: a
// binding record, a value under a tag, an error and its facts, the doubles
// at their bounds, the print a kind declares, and the names `env` answers,
// which the parser reads back.

import { describe, it, expect } from 'vitest';
import { compareValues, makeSet } from '../../src/ordering.mjs';
import { createSession, evalQuery } from '../../src/session.mjs';
import { printValue } from '../../src/print-value.mjs';
import { toPlain, fromPlain } from '../../src/runtime/json.mjs';
import {
  makeBinding,
  keyword,
  makeTag,
  makeTagged,
  makeErrorValue,
  isMap,
  isErrorValue,
  BuiltinForeignValueError
} from '../../src/types.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { printAnswer, caretOf } from '../../src/runtime/print.mjs';

describe('printValue — a binding record and a vector under a tag', () => {
  it('renders a binding record as the tagged Map it is', () => {
    const record = makeBinding({ name: keyword('nums'), value: [1, 2, 3] });
    expect(printValue(record)).toBe(
      '::binding{\n  :name :nums\n  :docs []\n  :value [1 2 3]\n  :source null\n  :origin null\n}');
  });

  it('renders a vector under a tag as ::Tag[payload…]', () => {
    const tagged = makeTagged(makeTag('Box'), [42, 'inner']);
    expect(printValue(tagged)).toBe('::Box[42 "inner"]');
  });

  it('renders a tag over an empty vector as ::Tag[]', () => {
    const tagged = makeTagged(makeTag('Marker'), []);
    expect(printValue(tagged)).toBe('::Marker[]');
  });
});

describe('the print of a failure, its tag before the bang and its facts', () => {
  it('an error of the kind of errors prints without its kind', async () => {
    // The kind of errors is the one `!{…}` implies, so its print writes no tag before the bang [QSERR#rest].
    const err = makeErrorValue(makeTag('error'), new Map());
    expect(printValue(err)).toBe('!{}');
  });

  it('a failure that flew no step prints its facts alone, and its print raised starts its trace at the raise [QSERR#print]', async () => {
    const err = makeErrorValue(makeTag('Foo'), new Map([['category', keyword('oops')]]));
    expect(printValue(err)).toBe('::Foo!{:category :oops}');
    expect(isErrorValue(await evalQuery(printValue(err)))).toBe(false);
    expect(compareValues(await evalQuery(`${printValue(err)} | raise !| trace | map ~failed`), await evalQuery('[~(raise)]')) === 0).toBe(true);
  });

  it('an answer that is a failure prints under the line that says it was raised, an error at rest under none [QSERR#rest]', async () => {
    const scope = await langRuntime();
    const failure = await evalQuery('"x" | add 1');
    expect(await printAnswer(failure, scope)).toBe(`|~| raised, and no !| caught it\n${printValue(failure)}`);
    const atRest = await evalQuery('"x" | add 1 !| it');
    expect(await printAnswer(atRest, scope)).toBe(printValue(atRest));
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

  it('draws a line past the excerpt within an excerpt around the place, an ellipsis where it cuts, the caret under the place as far as the excerpt reaches [QSERR#print]', async () => {
    const [tail, under] = (await caretOfQuery(refusalAt('x'.repeat(400), '349 1 350 349 1 351'))).split('\n');
    expect(tail).toBe(`|~| …${'x'.repeat(300)}`);
    expect(under).toBe(`|~| ${' '.repeat(250)}^`);
    const [middle, beneath] = (await caretOfQuery(refusalAt('x'.repeat(1000), '499 1 500 499 1 501'))).split('\n');
    expect(middle).toBe(`|~| …${'x'.repeat(300)}…`);
    expect(beneath).toBe(`|~| ${' '.repeat(151)}^`);
    const [, wide] = (await caretOfQuery(refusalAt('x'.repeat(1000), '499 1 500 899 1 900'))).split('\n');
    expect(wide).toBe(`|~| ${' '.repeat(151)}^${'~'.repeat(149)}`);
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

describe('toPlain encodes a tag over a set through the $tag envelope', () => {
  it('a tag over a set writes its payload as the array of its elements in JSON', () => {
    const taggedSet = makeTagged(makeTag('Keys'), makeSet([2, 1]));
    const plainSet = toPlain(taggedSet);
    expect(plainSet.$tag).toBe('Keys');
    expect(plainSet.payload).toEqual([1, 2]);
  });
});

describe('json of a boolean', () => {
  it('writes a boolean as the boolean of JSON, which parseJson reads back', async () => {
    expect(await evalQuery('true | json')).toBe('true');
    expect(await evalQuery('false | json')).toBe('false');
    expect(await evalQuery('[true false] | map ~(json | parseJson)')).toEqual([true, false]);
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

  it('an object of JavaScript lifts into a map keyed by its names', async () => {
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

describe('the finite-double domain holds at every render seam', () => {
  // A number past the doubles has no literal [QSLIT#number], and an answer
  // brought under `::number` past them is refused as `::number/NotFiniteError`
  // [QSNUM#arithmetic]; one a host hands meets the printer and the codec of
  // JSON, which raise it where they write it [QSHST#source].
  it('printValue refuses an infinity and a NaN as values of no kind', () => {
    for (const leaked of [Infinity, -Infinity, NaN]) {
      let thrown = null;
      try { printValue(leaked); } catch (caught) { thrown = caught; }
      expect(thrown).toBeInstanceOf(BuiltinForeignValueError);
      expect(thrown.name).toBe('ForeignValueError');
      expect(thrown.facts.actualValue).toBe(`number ${leaked}`);
    }
  });

  it('toPlain refuses the values the printer refuses', () => {
    for (const leaked of [Infinity, -Infinity, NaN]) {
      expect(() => toPlain(leaked), String(leaked)).toThrow(BuiltinForeignValueError);
    }
  });

  it('prints a number at the bounds of the doubles by its exponent', () => {
    expect(printValue(1e308)).toBe('1e+308');
    expect(printValue(-1e308)).toBe('-1e+308');
  });
});

// A kind whose `print` is declared under it prints its parts through it,
// and the forms of the core print the rest of the value [QSPRN#print].
describe('print — the print declared under a kind', () => {
  const BADGE_SOURCE = [
    ':badge |~~ A badge. ~~|',
    ':badge/print',
    '  |~~ A badge as its name. ~~|',
    '  ~(get /name)'
  ].join('\n');

  async function badgeSession() {
    return await createSession({ sources: [{ uri: 'badge', source: BADGE_SOURCE }] });
  }

  it('takes the print of a part from the kind of that part', async () => {
    const session = await badgeSession();
    const printed = await session.evalCell('[::badge{:name "ok"} {:k ::badge{:name "no"}} 1] | print');
    expect(printed.result).toBe('[\n  ok\n  {\n    :k no\n  }\n  1\n]');
  });

  it('takes the print of a kind for a part inside an error at rest, under a tag of its own or none', async () => {
    const session = await badgeSession();
    expect((await session.evalCell('[::error{:k ::badge{:name "in"}}] | print')).result).toBe('[\n  !{\n    :k in\n  }\n]');
    expect((await session.evalCell('[::Box::error{:k ::badge{:name "in"}}] | print')).result).toBe('[\n  ::Box!{\n    :k in\n  }\n]');
  });

  it('prints what a kind answers that is no string as the value it is', async () => {
    const session = await badgeSession();
    const printed = await session.evalCell('get [~(5 | tag ::badge)] | print');
    expect(printed.result).toContain('::path/SubjectHasNoPartsError!{');
  });
});

describe('the print and the JSON of env', () => {
  it('prints the records of the names a query declares as a literal that reads back as them', async () => {
    expect(await evalQuery(':f ~(add 1) | :v 5 | :T |~~ A kind. ~~| | env | :e it | print | parse | open | eq e')).toBe(true);
  });

  it('writes the JSON of a tag name a host hands in a scope as its literal', async () => {
    const scope = new Map(await langRuntime()).set('kindName', makeBinding({ name: keyword('kindName'), value: makeTag('Foo') }));
    const session = await createSession({ scope });
    const parsed = JSON.parse((await session.evalCell('env | json')).result);
    expect(parsed.kindName.payload.value).toBe('::Foo');
  });
});

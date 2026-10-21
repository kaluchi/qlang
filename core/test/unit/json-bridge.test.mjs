// JSON at the edges of the language: `fromPlain` and `fromJsonText` read a
// document into the values its literal reads, refusing a number past the
// finite doubles at its path, `toPlain` refuses a value of no kind, and
// `json` writes a descriptor as data.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';
import { fromJsonText, fromPlain, toPlain } from '../../src/runtime/json.mjs';
import { BuiltinForeignValueError } from '../../src/types.mjs';

describe('fromPlain lifts a parsed document', () => {
  it('a parsed document lifts into the same map a literal reads into', async () => {
    const lifted = fromPlain(JSON.parse('{"a": [1, 2]}'));
    const read = await evalQuery('{"a": [1, 2]}');
    const { compareValues } = await import('../../src/ordering.mjs');
    expect(compareValues(lifted, read) === 0).toBe(true);
  });
});

describe('fromPlain refuses a JSON number past the finite double range', () => {
  // `JSON.parse` reads a magnitude past the range as an infinity, which the
  // lift refuses at the path to it [QSPRN#json].
  it('lifts an out-of-range magnitude into a per-site codec error, with no path where it is the whole text', async () => {
    const { StringParseJsonNumberNotFiniteError } = await import('../../src/runtime/json.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('1e400')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(StringParseJsonNumberNotFiniteError);
    expect(thrown.address).toBe('string/parseJson/NumberNotFiniteError');
    expect(thrown.facts.path).toBeUndefined();
  });

  it('names the path it walked to when the magnitude sits nested', async () => {
    const { StringParseJsonNumberNotFiniteError } = await import('../../src/runtime/json.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('{"a": {"b": [1, 1e400]}}')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(StringParseJsonNumberNotFiniteError);
    expect(thrown.facts.path.segments).toEqual(['a', 'b', '1']);
  });

  it('lifts every in-range magnitude unchanged', async () => {
    expect(fromPlain(JSON.parse('1e308'))).toBe(1e308);
    expect(fromPlain(JSON.parse('-1e308'))).toBe(-1e308);
    expect(fromPlain(JSON.parse('0'))).toBe(0);
  });
});

describe('toPlain refuses a value of no kind of the language where it reads its kind [QSHST#source]', () => {
  it('refuses an object of JavaScript a host handed', () => {
    expect(() => toPlain(new Date())).toThrow(BuiltinForeignValueError);
  });

  it('names what it refused as JavaScript holds it, and no kind of it', () => {
    let refused;
    try { toPlain([Symbol('s')]); } catch (error) { refused = error; }
    expect(refused.facts).toEqual({ actualValue: 'symbol Symbol(s)' });
  });
});

describe('a descriptor is data [QSSLF#page]', () => {
  it('writes its keyword field as its name in JSON', async () => {
    expect(await evalQuery('::builtin{:note :draft} | json')).toContain('"note":"draft"');
  });
});

describe('a JSON text reads as its literal reads, the keys in the order it writes them [QSLIT#json]', () => {
  it('keeps a key that reads as an index in its place among the others', async () => {
    const text = '{"b": 1, "2": 2, "a": 3}';
    expect([...fromJsonText(text).keys()]).toEqual(['b', '2', 'a']);
    expect([...(await evalQuery(text)).keys()]).toEqual(['b', '2', 'a']);
    expect([...(await evalQuery(`${JSON.stringify(text)} | parseJson`)).keys()]).toEqual(['b', '2', 'a']);
  });

  it('reads every kind a document writes, through any whitespace', async () => {
    const text = ' \t{ "v" :\r\n[ 1 , -2.5e1 , "q\\"t\\\\" , true , false , null , { } , [ ] ] }\n';
    const { compareValues } = await import('../../src/ordering.mjs');
    expect(compareValues(fromJsonText(text), await evalQuery('{:v [1 -25 "q\\"t\\\\" true false null {} []]}')) === 0).toBe(true);
    expect(fromJsonText('5')).toBe(5);
    expect(fromJsonText('"x"')).toBe('x');
  });

  it('stands a key written twice in its first place with its last value', () => {
    const read = fromJsonText('{"a": {"x": 1}, "b": 2, "a": {"y": 3}}');
    expect([...read.keys()]).toEqual(['a', 'b']);
    expect([...read.get('a').keys()]).toEqual(['y']);
  });

  it('refuses a number past the doubles at its path', () => {
    let thrown = null;
    try { fromJsonText('{"a": {"b": [1, 1e400]}}'); } catch (caught) { thrown = caught; }
    expect(thrown.address).toBe('string/parseJson/NumberNotFiniteError');
    expect(thrown.facts.path.segments).toEqual(['a', 'b', '1']);
  });

  it('writes a key JavaScript reads as the prototype as any key', async () => {
    expect(await evalQuery('{:"__proto__" 1 :b 2} | json')).toBe('{"__proto__":1,"b":2}');
    expect([...fromJsonText('{"__proto__": 1}').keys()]).toEqual(['__proto__']);
  });
});

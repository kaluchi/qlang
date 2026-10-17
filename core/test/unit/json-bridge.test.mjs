// JSON at the edges of the language: its syntax reads into the one map
// and the one vector, a document's data never forges a value-class,
// and the lift from parsed JSON keeps numbers in the finite range.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isMap, isVec, formOf, typeOf, makeTag } from '../../src/types.mjs';
import { fromJsonText, fromPlain, toPlain, BuiltinJsonValueNotEncodableError } from '../../src/runtime/format.mjs';

describe('JSON syntax reads into the one map and the one vector', () => {
  it('an object literal is a map keyed by the keywords of its strings', async () => {
    const readMap = await evalQuery('{"a": 1, "b c": 2}');
    expect(isMap(readMap)).toBe(true);
    expect(typeOf(readMap)).toEqual(makeTag('map'));
    expect([...readMap.keys()]).toEqual(['a', 'b c']);
  });

  it('an array literal and a single-element bracket are vectors', async () => {
    for (const source of ['[1, 2]', '[1]', '[{"a": 1}]']) {
      const readVec = await evalQuery(source);
      expect(isVec(readVec), source).toBe(true);
      expect(formOf(readVec), source).toBe('vec');
    }
  });

  it('a parsed document lifts into the same map a literal reads into', async () => {
    const lifted = fromPlain(JSON.parse('{"a": [1, 2]}'));
    const read = await evalQuery('{"a": [1, 2]}');
    const { deepEqual } = await import('../../src/equality.mjs');
    expect(deepEqual(lifted, read)).toBe(true);
  });
});

describe('a map whose data key "type" collides with a value-class name', () => {
  // `"type"` is ordinary data, never a value-class discriminator. The
  // discriminator rides on the VALUE_CLASS_TAG symbol that only the
  // real value-class factories stamp, so a document carrying
  // `"type":"quote"` stays a map through classification, a read by a path,
  // equality, and the lossy and lossless JSON codecs.

  it('classifies as a map regardless of the "type" data value', async () => {
    for (const typeValue of ['quote', 'doc', 'keyword', 'tag', 'error', 'function', 'underTag']) {
      const readMap = await evalQuery(`{"type": "${typeValue}", "extra": 1}`);
      expect(formOf(readMap), `formOf for type=${typeValue}`).toBe('map');
    }
  });

  it('value-class predicates reject a map that forges their .type tag', async () => {
    const { isKeyword, isQuote, isDoc, isErrorValue, isTag } = await import('../../src/types.mjs');
    expect(isKeyword(fromPlain({ type: 'keyword', name: 'x' }))).toBe(false);
    expect(isQuote(fromPlain({ type: 'quote', source: 'x' }))).toBe(false);
    expect(isDoc(fromPlain({ type: 'doc', content: 'x' }))).toBe(false);
    expect(isErrorValue(fromPlain({ type: 'error' }))).toBe(false);
    expect(isTag(fromPlain({ type: 'tag', name: 'X' }))).toBe(false);
  });

  it('| json preserves a {"type":"keyword"} document losslessly', async () => {
    const jsonText = await evalQuery('{"type": "keyword", "name": "x"} | json');
    expect(JSON.parse(jsonText)).toEqual({ type: 'keyword', name: 'x' });
  });

  it('| json does not rewrite a {"type":"quote"} document into a Quote literal', async () => {
    const jsonText = await evalQuery('{"type": "quote", "source": "hi"} | json');
    expect(JSON.parse(jsonText)).toEqual({ type: 'quote', source: 'hi' });
  });

  it('a {"type":"error"} document does not crash the evaluator', async () => {
    const result = await evalQuery('{"type": "error", "msg": "boom"} | type');
    expect(result).toEqual(makeTag('map'));
  });
});

describe('fromPlain refuses a JSON number past the finite double range', () => {
  // `JSON.parse` reads a magnitude past the range as an infinity, so
  // the lift is the boundary that keeps it out of the pipeline —
  // `cat huge.json | qlang '/big'` seeds through this exact path.
  it('lifts an out-of-range magnitude into a per-site codec error', async () => {
    const { StringParseJsonNumberNotFiniteError } = await import('../../src/runtime/format.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('1e400')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(StringParseJsonNumberNotFiniteError);
    expect(thrown.address).toBe('string/parseJson/NumberNotFiniteError');
    expect(thrown.facts.path).toEqual([]);
  });

  it('names the path it walked to when the magnitude sits nested', async () => {
    const { StringParseJsonNumberNotFiniteError } = await import('../../src/runtime/format.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('{"a": {"b": [1, 1e400]}}')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(StringParseJsonNumberNotFiniteError);
    expect(thrown.facts.path).toEqual(['a', 'b', 1]);
  });

  it('lifts every in-range magnitude unchanged', async () => {
    expect(fromPlain(JSON.parse('1e308'))).toBe(1e308);
    expect(fromPlain(JSON.parse('-1e308'))).toBe(-1e308);
    expect(fromPlain(JSON.parse('0'))).toBe(0);
  });
});

describe('toPlain refuses a value JSON has no form for', () => {
  it('refuses a raw object of the host', () => {
    expect(() => toPlain(new Date())).toThrow(BuiltinJsonValueNotEncodableError);
  });

  it('names the JavaScript type of what it refused', () => {
    let refused;
    try { toPlain(Symbol('s')); } catch (error) { refused = error; }
    expect(refused.facts.actualType).toBe('symbol');
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
    const { deepEqual } = await import('../../src/equality.mjs');
    expect(deepEqual(fromJsonText(text), await evalQuery('{:v [1 -25 "q\\"t\\\\" true false null {} []]}'))).toBe(true);
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
    expect(thrown.facts.path).toEqual(['a', 'b', 1]);
  });

  it('writes a key JavaScript reads as the prototype as any key', async () => {
    expect(await evalQuery('{:"__proto__" 1 :b 2} | json')).toBe('{"__proto__":1,"b":2}');
    expect([...fromJsonText('{"__proto__": 1}').keys()]).toEqual(['__proto__']);
  });
});

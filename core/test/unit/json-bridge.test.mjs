// JSON at the edges of the language: its syntax reads into the one map
// and the one vector, a document's data never forges a value-class,
// and the lift from parsed JSON keeps numbers in the finite range.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isQMap, isVec, describeType, typeKeyword, makeTagKeyword } from '../../src/types.mjs';
import { fromPlain } from '../../src/runtime/format.mjs';

describe('JSON syntax reads into the one map and the one vector', () => {
  it('an object literal is a map keyed by the keywords of its strings', async () => {
    const readMap = await evalQuery('{"a": 1, "b c": 2}');
    expect(isQMap(readMap)).toBe(true);
    expect(typeKeyword(readMap)).toEqual(makeTagKeyword('map'));
    expect([...readMap.keys()]).toEqual(['a', 'b c']);
  });

  it('an array literal and a single-element bracket are vectors', async () => {
    for (const source of ['[1, 2]', '[1]', '[{"a": 1}]']) {
      const readVec = await evalQuery(source);
      expect(isVec(readVec), source).toBe(true);
      expect(describeType(readVec), source).toBe('Vec');
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
  // `"type":"quote"` stays a map through classification, projection,
  // equality, and the lossy and lossless JSON codecs.

  it('classifies as a map regardless of the "type" data value', async () => {
    for (const typeValue of ['quote', 'doc', 'keyword', 'tagKeyword', 'error', 'function', 'taggedInstance']) {
      const readMap = await evalQuery(`{"type": "${typeValue}", "extra": 1}`);
      expect(describeType(readMap), `describeType for type=${typeValue}`).toBe('Map');
    }
  });

  it('value-class predicates reject a map that forges their .type tag', async () => {
    const { isKeyword, isQuote, isDoc, isErrorValue, isFunctionValue, isTagKeyword } = await import('../../src/types.mjs');
    expect(isKeyword(fromPlain({ type: 'keyword', name: 'x' }))).toBe(false);
    expect(isQuote(fromPlain({ type: 'quote', source: 'x' }))).toBe(false);
    expect(isDoc(fromPlain({ type: 'doc', content: 'x' }))).toBe(false);
    expect(isErrorValue(fromPlain({ type: 'error' }))).toBe(false);
    expect(isFunctionValue(fromPlain({ type: 'function' }))).toBe(false);
    expect(isTagKeyword(fromPlain({ type: 'tagKeyword', name: 'X' }))).toBe(false);
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
    expect(result).toEqual(makeTagKeyword('map'));
  });

  it('toTaggedJSON round-trips a {"type":"keyword"} document as a map', async () => {
    const { toTaggedJSON, fromTaggedJSON } = await import('../../src/codec.mjs');
    const back = fromTaggedJSON(toTaggedJSON(fromPlain({ type: 'keyword', name: 'x' })));
    expect(describeType(back)).toBe('Map');
    expect(back.get('type')).toBe('keyword');
  });
});

describe('fromPlain refuses a JSON number past the finite double range', () => {
  // `JSON.parse` reads a magnitude past the range as an infinity, so
  // the lift is the boundary that keeps it out of the pipeline —
  // `cat huge.json | qlang '/big'` seeds through this exact path.
  it('lifts an out-of-range magnitude into a per-site codec error', async () => {
    const { FromPlainNumberNotFiniteError } = await import('../../src/runtime/format.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('1e400')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(FromPlainNumberNotFiniteError);
    expect(thrown.name).toBe('FromPlainNumberNotFiniteError');
    expect(thrown.kind).toBe('codecError');
    expect(thrown.context.path).toEqual([]);
  });

  it('names the slot it walked to when the magnitude sits nested', async () => {
    const { FromPlainNumberNotFiniteError } = await import('../../src/runtime/format.mjs');
    let thrown = null;
    try { fromPlain(JSON.parse('{"a": {"b": [1, 1e400]}}')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(FromPlainNumberNotFiniteError);
    expect(thrown.context.path).toEqual(['a', 'b', 1]);
  });

  it('lifts every in-range magnitude unchanged', async () => {
    expect(fromPlain(JSON.parse('1e308'))).toBe(1e308);
    expect(fromPlain(JSON.parse('-1e308'))).toBe(-1e308);
    expect(fromPlain(JSON.parse('0'))).toBe(0);
  });
});

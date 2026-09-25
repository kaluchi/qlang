// Tests for codec.mjs — tagged-JSON value encoding/decoding.

import { describe, it, expect } from 'vitest';
import {
  toTaggedJSON,
  fromTaggedJSON,
  TaggedJSONUnencodableValueError,
  TaggedJSONNumberNotFiniteError,
  MalformedTaggedJSONError
} from '../../src/codec.mjs';
import {
  keyword,
  makeTagKeyword,
  isTagKeyword,
  makeConduit,
  makeSnapshot,
  isQuote,
  makeDoc,
  isDoc,
  makeSet,
  isQSet
} from '../../src/types.mjs';
import { deepEqual } from '../../src/equality.mjs';
import { makeFn } from '../../src/rule10.mjs';
import { quoteOfSource, printQuoteSource } from '../../src/quote.mjs';
import { QlangError } from '../../src/errors.mjs';

describe('toTaggedJSON / fromTaggedJSON round-trip', () => {
  function roundTrip(value) {
    const encoded = toTaggedJSON(value);
    const jsonText = JSON.stringify(encoded);
    const reparsed = JSON.parse(jsonText);
    return fromTaggedJSON(reparsed);
  }

  it('round-trips scalars', () => {
    expect(roundTrip(42)).toBe(42);
    expect(roundTrip(-3.14)).toBe(-3.14);
    expect(roundTrip('hello')).toBe('hello');
    expect(roundTrip(true)).toBe(true);
    expect(roundTrip(false)).toBe(false);
    expect(roundTrip(null)).toBe(null);
  });

  it('round-trips a keyword to the same interned object', () => {
    const kw = keyword('foo');
    const restored = roundTrip(kw);
    expect(restored).toEqual(kw);
  });

  it('round-trips a TagKeyword via $tagKeyword tag', () => {
    const tk = makeTagKeyword('Foo');
    expect(toTaggedJSON(tk)).toEqual({ $tagKeyword: 'Foo' });
    const restored = roundTrip(tk);
    expect(isTagKeyword(restored)).toBe(true);
    expect(restored.name).toBe('Foo');
  });

  it('round-trips a Vec carrying a TagKeyword (the `result | type` shape)', () => {
    const restored = roundTrip([makeTagKeyword('Box'), 1]);
    expect(isTagKeyword(restored[0])).toBe(true);
    expect(restored[0].name).toBe('Box');
    expect(restored[1]).toBe(1);
  });

  it('round-trips a Vec of numbers', () => {
    expect(roundTrip([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('round-trips a Quote via $quote tag', () => {
    const original = quoteOfSource('mul 2');
    const encoded = toTaggedJSON(original);
    expect(encoded).toEqual({ $quote: 'mul 2' });
    const restored = fromTaggedJSON(encoded);
    expect(isQuote(restored)).toBe(true);
    expect(printQuoteSource(restored)).toBe('mul 2');
  });

  it('reads a tagged envelope under the code tag back as a quote', () => {
    const restored = fromTaggedJSON({ $tagged: { $tag: 'quote', payload: [1] } });
    expect(isQuote(restored)).toBe(true);
    expect(printQuoteSource(restored)).toBe('1');
  });

  it('round-trips a Quote with combinator-prefixed source (trail-suffix)', () => {
    const original = quoteOfSource('* inc | sort');
    const restored = roundTrip(original);
    expect(isQuote(restored)).toBe(true);
    expect(printQuoteSource(restored)).toBe('* inc | sort');
  });

  it('round-trips a Doc via $doc tag', () => {
    const original = makeDoc(' note ');
    const encoded = toTaggedJSON(original);
    expect(encoded).toEqual({ $doc: ' note ' });
    const restored = fromTaggedJSON(encoded);
    expect(isDoc(restored)).toBe(true);
    expect(restored.content).toBe(' note ');
  });

  it('round-trips a Doc with multi-line content preserving newlines', () => {
    const original = makeDoc('\n  one\n  two\n');
    const restored = roundTrip(original);
    expect(isDoc(restored)).toBe(true);
    expect(restored.content).toBe('\n  one\n  two\n');
  });

  it('round-trips a nested Vec', () => {
    expect(roundTrip([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });

  it('round-trips a Map with keyword keys', () => {
    const mapValue = new Map();
    mapValue.set('name', 'Alice');
    mapValue.set('age', 30);
    const restored = roundTrip(mapValue);
    expect(restored).toBeInstanceOf(Map);
    expect(restored.size).toBe(2);
    expect(restored.get('name')).toBe('Alice');
    expect(restored.get('age')).toBe(30);
  });

  it('round-trips a Set of mixed scalars', () => {
    const setValue = makeSet([1, 'two', true]);
    const restored = roundTrip(setValue);
    expect(isQSet(restored)).toBe(true);
    expect(deepEqual(restored, setValue)).toBe(true);
  });

  it('writes a set as the vector under its tag and reads it through the constructor', () => {
    expect(toTaggedJSON(makeSet([2, 1]))).toEqual({ $tagged: { $tag: 'set', payload: [1, 2] } });
    const restored = fromTaggedJSON({ $tagged: { $tag: 'set', payload: [3, 1, 3] } });
    expect(isQSet(restored)).toBe(true);
    expect([...restored]).toEqual([1, 3]);
  });

  it('round-trips deeply nested Vec/Map/Set', () => {
    const mapValue = new Map();
    mapValue.set('items', [1, 2, makeSet([3, 4])]);
    mapValue.set('meta', new Map([['count', 2]]));
    const restored = roundTrip(mapValue);
    expect(restored).toBeInstanceOf(Map);
    const items = restored.get('items');
    expect(isQSet(items[2])).toBe(true);
  });

  it('writes a Vec as a bare JSON array and a Map in its envelope', () => {
    expect(toTaggedJSON([1, 2])).toEqual([1, 2]);
    expect(toTaggedJSON(new Map([['a', 1]]))).toEqual({ $map: [['a', 1]] });
  });

  it('reads a bare JSON array as a Vec and a bare JSON object as a Map', () => {
    expect(fromTaggedJSON([1, [2]])).toEqual([1, [2]]);
    const restored = fromTaggedJSON({ a: 1, b: { c: [2] } });
    expect(restored).toBeInstanceOf(Map);
    expect(restored.get('b')).toBeInstanceOf(Map);
    expect(restored.get('b').get('c')).toEqual([2]);
  });

  it('keeps a Map whose key spells an envelope a Map', () => {
    const restored = roundTrip(new Map([['$keyword', 'x']]));
    expect(restored).toBeInstanceOf(Map);
    expect(restored.get('$keyword')).toBe('x');
  });

  it('tagged Vec rides a bare JSON array inside $tagged', async () => {
    const { makeTagKeyword, makeTaggedInstance, isTaggedInstance } = await import('../../src/types.mjs');
    const tagged = makeTaggedInstance(makeTagKeyword('Box'), [1, 2]);
    expect(toTaggedJSON(tagged)).toEqual({ $tagged: { $tag: 'Box', payload: [1, 2] } });
    const restored = roundTrip(tagged);
    expect(isTaggedInstance(restored)).toBe(true);
    expect(restored).toEqual([1, 2]);
  });
});

describe('toTaggedJSON unencodable values', () => {
  it('throws TaggedJSONUnencodableValueError for conduits', () => {
    const conduit = makeConduit({ type: 'NumberLit', value: 1, text: '1' }, { name: 'x' });
    expect(() => toTaggedJSON(conduit)).toThrow(TaggedJSONUnencodableValueError);
  });

  it('throws TaggedJSONUnencodableValueError for snapshots', () => {
    const snap = makeSnapshot(42, { name: 'x' });
    expect(() => toTaggedJSON(snap)).toThrow(TaggedJSONUnencodableValueError);
  });

  it('throws TaggedJSONUnencodableValueError for function values', () => {
    // langRuntime stores each built-in as a descriptor Map
    // (encodable). Function values still exist at the JS level —
    // every runtime/*.mjs primitive impl is one, and
    // conduitParameter proxies create fresh ones at applyConduit
    // time — so the unencodable-function contract stays
    // load-bearing. Construct one directly via makeFn to exercise
    // the codec guard without depending on env contents.
    const fn = makeFn('testFn', 1, (state) => state, { captured: [0, 0] });
    expect(() => toTaggedJSON(fn)).toThrow(TaggedJSONUnencodableValueError);
  });

  it('throws on totally foreign object types', () => {
    expect(() => toTaggedJSON(Symbol('weird'))).toThrow(TaggedJSONUnencodableValueError);
  });
});

describe('fromTaggedJSON malformed input', () => {
  it('treats null/undefined as null', () => {
    expect(fromTaggedJSON(null)).toBeNull();
    expect(fromTaggedJSON(undefined)).toBeNull();
  });

  it('throws MalformedTaggedJSONError on a non-JSON JS value (Symbol)', () => {
    expect(() => fromTaggedJSON(Symbol('weird'))).toThrow(MalformedTaggedJSONError);
  });

  it('decodes a single-key object with an unknown $-prefixed key as a Map (data-as-object)', () => {
    const restored = fromTaggedJSON({ $weird: 1 });
    expect(restored).toBeInstanceOf(Map);
    expect(restored.get('$weird')).toBe(1);
  });

  it('decodes a multi-key object even when one key looks like an envelope marker', () => {
    const restored = fromTaggedJSON({ $keyword: 'kw', other: 2 });
    expect(restored).toBeInstanceOf(Map);
    expect(restored.get('$keyword')).toBe('kw');
    expect(restored.get('other')).toBe(2);
  });

  it('throws MalformedTaggedJSONError on a $tagged envelope without an inner object', () => {
    expect(() => fromTaggedJSON({ $tagged: null })).toThrow(MalformedTaggedJSONError);
  });

  it('throws MalformedTaggedJSONError on a $tagged envelope missing the $tag slot', () => {
    expect(() => fromTaggedJSON({ $tagged: { payload: 42 } })).toThrow(MalformedTaggedJSONError);
  });

  it('throws MalformedTaggedJSONError on an $error envelope without an inner object', () => {
    expect(() => fromTaggedJSON({ $error: null })).toThrow(MalformedTaggedJSONError);
  });

  it('throws MalformedTaggedJSONError on an $error envelope missing the $tag slot', () => {
    expect(() => fromTaggedJSON({ $error: { descriptor: { $map: [] } } })).toThrow(MalformedTaggedJSONError);
  });
});

describe('fromTaggedJSON refuses a number past the finite double range', () => {
  // A restored session or a conformance fixture travels as plain
  // JSON, where `JSON.parse` reads an out-of-range magnitude as an
  // infinity. The decoder is the boundary that keeps it out.
  it('refuses a bare out-of-range number', () => {
    let thrown = null;
    try { fromTaggedJSON(JSON.parse('1e400')); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(TaggedJSONNumberNotFiniteError);
    expect(thrown).toBeInstanceOf(QlangError);
    expect(thrown.name).toBe('TaggedJSONNumberNotFiniteError');
    expect(thrown.kind).toBe('codecError');
    expect(thrown.context.path).toEqual([]);
  });

  it('names the envelope slot it walked to', () => {
    let thrown = null;
    try { fromTaggedJSON(JSON.parse('{"$map":[[{"$keyword":"big"}, 1e400]]}')); }
    catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(TaggedJSONNumberNotFiniteError);
    expect(thrown.context.path).toEqual(['big']);
    let nested = null;
    try { fromTaggedJSON(JSON.parse('[0, 1e400]')); } catch (caught) { nested = caught; }
    expect(nested.context.path).toEqual([1]);
    // A set rides the `$tagged` envelope, so the path names its tag
    // and then the index.
    let inSet = null;
    try { fromTaggedJSON(JSON.parse('{"$tagged":{"$tag":"set","payload":[0, 1e400]}}')); } catch (caught) { inSet = caught; }
    expect(inSet.context.path).toEqual(['set', 1]);
  });

  it('decodes every in-range magnitude unchanged', () => {
    expect(fromTaggedJSON(JSON.parse('1e308'))).toBe(1e308);
    expect(fromTaggedJSON(JSON.parse('[-1e308, 0]'))).toEqual([-1e308, 0]);
  });
});

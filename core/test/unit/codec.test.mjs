// Tests for codec.mjs — tagged-JSON value encoding/decoding.

import { describe, it, expect } from 'vitest';
import {
  toTaggedJSON,
  fromTaggedJSON,
  TaggedJSONUnencodableValueError,
  MalformedTaggedJSONError
} from '../../src/codec.mjs';
import {
  keyword,
  makeConduit,
  makeSnapshot,
  makeQuote,
  isQuote,
  makeDoc,
  isDoc,
  makeJsonObject,
  makeJsonArray,
  isJsonObject,
  isJsonArray
} from '../../src/types.mjs';
import { makeFn } from '../../src/rule10.mjs';

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

  it('round-trips a Vec of numbers', () => {
    expect(roundTrip([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('round-trips a Quote via $quote tag', () => {
    const original = makeQuote('mul(2)');
    const encoded = toTaggedJSON(original);
    expect(encoded).toEqual({ $quote: 'mul(2)' });
    const restored = fromTaggedJSON(encoded);
    expect(isQuote(restored)).toBe(true);
    expect(restored.source).toBe('mul(2)');
  });

  it('round-trips a Quote with combinator-prefixed source (trail-suffix)', () => {
    const original = makeQuote('* inc | sort');
    const restored = roundTrip(original);
    expect(isQuote(restored)).toBe(true);
    expect(restored.source).toBe('* inc | sort');
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
    const setValue = new Set([1, 'two', true]);
    const restored = roundTrip(setValue);
    expect(restored).toBeInstanceOf(Set);
    expect(restored.has(1)).toBe(true);
    expect(restored.has('two')).toBe(true);
    expect(restored.has(true)).toBe(true);
  });

  it('round-trips deeply nested Vec/Map/Set', () => {
    const mapValue = new Map();
    mapValue.set('items', [1, 2, new Set([3, 4])]);
    mapValue.set('meta', new Map([['count', 2]]));
    const restored = roundTrip(mapValue);
    expect(restored).toBeInstanceOf(Map);
    const items = restored.get('items');
    expect(items[2]).toBeInstanceOf(Set);
  });

  it('round-trips a JsonObject preserving the JSON_OBJECT_TAG', () => {
    const original = makeJsonObject({ a: 1, b: 'two', c: true });
    const restored = roundTrip(original);
    expect(isJsonObject(restored)).toBe(true);
    expect(restored.a).toBe(1);
    expect(restored.b).toBe('two');
    expect(restored.c).toBe(true);
  });

  it('round-trips a JsonArray preserving the JSON_ARRAY_TAG', () => {
    const original = makeJsonArray([1, 2, 3]);
    const restored = roundTrip(original);
    expect(isJsonArray(restored)).toBe(true);
    expect(restored).toEqual([1, 2, 3]);
  });

  it('round-trips a JsonArray of JsonObjects (nested JSON shape)', () => {
    const original = makeJsonArray([
      makeJsonObject({ id: 1, name: 'a' }),
      makeJsonObject({ id: 2, name: 'b' })
    ]);
    const restored = roundTrip(original);
    expect(isJsonArray(restored)).toBe(true);
    expect(restored.length).toBe(2);
    expect(isJsonObject(restored[0])).toBe(true);
    expect(restored[0].name).toBe('a');
    expect(isJsonObject(restored[1])).toBe(true);
    expect(restored[1].id).toBe(2);
  });

  it('round-trips a JsonObject with nested JsonArray values', () => {
    const original = makeJsonObject({
      tags: makeJsonArray(['x', 'y']),
      meta: makeJsonObject({ depth: 2 })
    });
    const restored = roundTrip(original);
    expect(isJsonObject(restored)).toBe(true);
    expect(isJsonArray(restored.tags)).toBe(true);
    expect(restored.tags).toEqual(['x', 'y']);
    expect(isJsonObject(restored.meta)).toBe(true);
    expect(restored.meta.depth).toBe(2);
  });

  it('JsonArray vs Vec stay distinguishable across the encode/decode boundary', () => {
    const jArr = roundTrip(makeJsonArray([1, 2]));
    const vec  = roundTrip([1, 2]);
    expect(isJsonArray(jArr)).toBe(true);
    expect(isJsonArray(vec)).toBe(false);
  });

  it('JsonObject vs qlang Map stay distinguishable across the encode/decode boundary', () => {
    const jObj = roundTrip(makeJsonObject({ a: 1 }));
    const qMap = roundTrip(new Map([['a', 1]]));
    expect(isJsonObject(jObj)).toBe(true);
    expect(jObj instanceof Map).toBe(false);
    expect(qMap).toBeInstanceOf(Map);
    expect(isJsonObject(qMap)).toBe(false);
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

  it('decodes a single-key object with an unknown $-prefixed key as a JsonObject (data-as-object)', () => {
    const restored = fromTaggedJSON({ $weird: 1 });
    expect(isJsonObject(restored)).toBe(true);
    expect(restored.$weird).toBe(1);
  });

  it('decodes a multi-key object even when one key looks like an envelope marker', () => {
    const restored = fromTaggedJSON({ $keyword: 'kw', other: 2 });
    expect(isJsonObject(restored)).toBe(true);
    expect(restored.$keyword).toBe('kw');
    expect(restored.other).toBe(2);
  });
});

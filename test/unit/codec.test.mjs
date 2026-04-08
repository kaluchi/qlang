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
  makeThunk,
  makeSnapshot
} from '../../src/types.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';

describe('toTaggedJSON / fromTaggedJSON round-trip', () => {
  function roundTrip(value) {
    const encoded = toTaggedJSON(value);
    const json = JSON.stringify(encoded);
    const reparsed = JSON.parse(json);
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
    expect(restored).toBe(kw); // identity preserved by intern table
  });

  it('round-trips a Vec of numbers', () => {
    expect(roundTrip([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('round-trips a nested Vec', () => {
    expect(roundTrip([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });

  it('round-trips a Map with keyword keys', () => {
    const m = new Map();
    m.set(keyword('name'), 'Alice');
    m.set(keyword('age'), 30);
    const restored = roundTrip(m);
    expect(restored).toBeInstanceOf(Map);
    expect(restored.size).toBe(2);
    expect(restored.get(keyword('name'))).toBe('Alice');
    expect(restored.get(keyword('age'))).toBe(30);
  });

  it('round-trips a Set of mixed scalars', () => {
    const s = new Set([1, 'two', true]);
    const restored = roundTrip(s);
    expect(restored).toBeInstanceOf(Set);
    expect(restored.has(1)).toBe(true);
    expect(restored.has('two')).toBe(true);
    expect(restored.has(true)).toBe(true);
  });

  it('round-trips deeply nested Vec/Map/Set', () => {
    const m = new Map();
    m.set(keyword('items'), [1, 2, new Set([3, 4])]);
    m.set(keyword('meta'), new Map([[keyword('count'), 2]]));
    const restored = roundTrip(m);
    expect(restored).toBeInstanceOf(Map);
    const items = restored.get(keyword('items'));
    expect(items[2]).toBeInstanceOf(Set);
  });
});

describe('toTaggedJSON unencodable values', () => {
  it('throws TaggedJSONUnencodableValueError for thunks', () => {
    const thunk = makeThunk({ type: 'NumberLit', value: 1 }, { name: 'x' });
    expect(() => toTaggedJSON(thunk)).toThrow(TaggedJSONUnencodableValueError);
  });

  it('throws TaggedJSONUnencodableValueError for snapshots', () => {
    const snap = makeSnapshot(42, { name: 'x' });
    expect(() => toTaggedJSON(snap)).toThrow(TaggedJSONUnencodableValueError);
  });

  it('throws TaggedJSONUnencodableValueError for function values', () => {
    const fn = langRuntime().get(keyword('count'));
    expect(() => toTaggedJSON(fn)).toThrow(TaggedJSONUnencodableValueError);
  });

  it('throws on totally foreign object types', () => {
    expect(() => toTaggedJSON(Symbol('weird'))).toThrow(TaggedJSONUnencodableValueError);
  });
});

describe('fromTaggedJSON malformed input', () => {
  it('throws MalformedTaggedJSONError on unrecognized tagged objects', () => {
    expect(() => fromTaggedJSON({ $weird: 1 })).toThrow(MalformedTaggedJSONError);
  });

  it('treats null/undefined as nil', () => {
    expect(fromTaggedJSON(null)).toBeNull();
    expect(fromTaggedJSON(undefined)).toBeNull();
  });
});

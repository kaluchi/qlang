import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { isSet } from '../../../src/types.mjs';
import { makeSet } from '../../../src/ordering.mjs';

describe('distinct — structural equality', () => {
  it('holds each keyword once', async () => {
    const result = await evalQuery('[:a :b :a :c] | distinct');
    expect(isSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(3);
    expect(items.map(k => k.name)).toEqual(['a', 'b', 'c']);
  });

  it('holds structural duplicates once, in the one order', async () => {
    const result = await evalQuery(
      '[{:id 2} {:id 1} {:id 2} {:id 3} {:id 1}] | distinct');
    expect(isSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(3);
    expect(items.map(m => m.get('id'))).toEqual([1, 2, 3]);
  });

  it('holds two maps of the same entries once, whatever the order of their entries', async () => {
    expect(await evalQuery('[{:a 1 :b 2} {:b 2 :a 1}] | distinct | count')).toBe(1);
  });

  it('holds each of mixed atoms and containers once', async () => {
    const result = await evalQuery('[1 {:a 1} 1 {:a 1} "x" "x"] | distinct');
    expect(isSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(3);
    expect(items[0]).toBe(1);
    expect(items[1]).toBe('x');
    expect(items[2].get('a')).toBe(1);
  });
});

it('tells a set from a vector', () => {
  expect(isSet(makeSet([]))).toBe(true);
  expect(isSet([])).toBe(false);
});

it('a set literal holds a keyword once', async () => {
  const { evalQuery } = await import('../../../src/notebook.mjs');
  const result = await evalQuery('#[:a :b :a]');
  expect(result.length).toBe(2);
});

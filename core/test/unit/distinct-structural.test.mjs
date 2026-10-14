// `distinct` holds each value once by the equality `eq` holds, two maps of
// the same entries one value however they were built, and answers a set,
// the vector in the one order without duplicates [D16].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isQSet } from '../../src/types.mjs';


describe('distinct — structural equality', () => {
  it('collapses two Maps with identical content', async () => {
    const result = await evalQuery('[{:fqn "a"} {:fqn "b"} {:fqn "a"}] | distinct');
    expect(isQSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(2);
    expect(items[0].get('fqn')).toBe('a');
    expect(items[1].get('fqn')).toBe('b');
  });

  it('count matches | map /fqn | distinct | count on Map-valued sequence', async () => {
    const byValue = await evalQuery(
      '[{:fqn "a"} {:fqn "b"} {:fqn "a"} {:fqn "c"} {:fqn "b"}] | distinct | count');
    const byFqn = await evalQuery(
      '[{:fqn "a"} {:fqn "b"} {:fqn "a"} {:fqn "c"} {:fqn "b"}] | map /fqn | distinct | count');
    expect(byValue).toBe(byFqn);
    expect(byValue).toBe(3);
  });

  it('collapses nested Vec elements with identical content', async () => {
    const result = await evalQuery('[[1 2] [3 4] [1 2]] | distinct');
    expect(isQSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual([1, 2]);
    expect(items[1]).toEqual([3, 4]);
  });

  it('holds each atom once', async () => {
    expect([...await evalQuery('[1 2 1 3 2] | distinct')]).toEqual([1, 2, 3]);
    expect([...await evalQuery('["a" "b" "a"] | distinct')]).toEqual(['a', 'b']);
  });

  it('preserves keyword dedup', async () => {
    const result = await evalQuery('[:a :b :a :c] | distinct');
    expect(isQSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(3);
    expect(items.map(k => k.name)).toEqual(['a', 'b', 'c']);
  });

  it('holds structural duplicates once, in the one order', async () => {
    const result = await evalQuery(
      '[{:id 2} {:id 1} {:id 2} {:id 3} {:id 1}] | distinct');
    expect(isQSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(3);
    expect(items.map(m => m.get('id'))).toEqual([1, 2, 3]);
  });

  it('holds each of mixed atoms and containers once', async () => {
    const result = await evalQuery('[1 {:a 1} 1 {:a 1} "x" "x"] | distinct');
    expect(isQSet(result)).toBe(true);
    const items = [...result];
    expect(items).toHaveLength(3);
    expect(items[0]).toBe(1);
    expect(items[1]).toBe('x');
    expect(items[2].get('a')).toBe(1);
  });

  it('identity on a Set subject', async () => {
    const result = await evalQuery('#[1 2 3] | distinct');
    expect(isQSet(result)).toBe(true);
    expect([...result]).toEqual([1, 2, 3]);
  });
});

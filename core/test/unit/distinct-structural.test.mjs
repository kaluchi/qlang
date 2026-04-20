// Regression: `distinct` must deduplicate by structural equality,
// not JS reference identity. Two Maps carrying the same :key value
// content are "duplicate" by the same axiom that drives `eq` — if
// `x | eq(y)` is true, `[x, y] | distinct` must collapse to one.
//
// The bug this fixture pins down: when two distinct JS Map objects
// carry identical content (the common shape produced by any graph
// walk that reaches the same logical node via multiple paths —
// diamond interface hierarchies, fan-in references), the old
// reference-equality `distinct` left both in the result. That
// broke downstream `count`, `filter`, `sort`, and anything else
// consuming the "unique" Vec.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';

describe('distinct — structural equality', () => {
  it('collapses two Maps with identical content', async () => {
    const result = await evalQuery('[{:fqn "a"} {:fqn "b"} {:fqn "a"}] | distinct');
    expect(result).toHaveLength(2);
    expect(result[0].get(keyword('fqn'))).toBe('a');
    expect(result[1].get(keyword('fqn'))).toBe('b');
  });

  it('count matches * /fqn | distinct | count on Map-valued Vec', async () => {
    const byValue = await evalQuery(
      '[{:fqn "a"} {:fqn "b"} {:fqn "a"} {:fqn "c"} {:fqn "b"}] | distinct | count');
    const byFqn = await evalQuery(
      '[{:fqn "a"} {:fqn "b"} {:fqn "a"} {:fqn "c"} {:fqn "b"}] * /fqn | distinct | count');
    expect(byValue).toBe(byFqn);
    expect(byValue).toBe(3);
  });

  it('collapses nested Vec elements with identical content', async () => {
    const result = await evalQuery('[[1 2] [3 4] [1 2]] | distinct');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([1, 2]);
    expect(result[1]).toEqual([3, 4]);
  });

  it('preserves scalar dedup (no regression on atoms)', async () => {
    expect(await evalQuery('[1 2 1 3 2] | distinct')).toEqual([1, 2, 3]);
    expect(await evalQuery('["a" "b" "a"] | distinct')).toEqual(['a', 'b']);
  });

  it('preserves keyword dedup', async () => {
    const result = await evalQuery('[:a :b :a :c] | distinct');
    expect(result).toHaveLength(3);
    expect(result.map(k => k.name)).toEqual(['a', 'b', 'c']);
  });

  it('preserves first-occurrence order across structural duplicates', async () => {
    const result = await evalQuery(
      '[{:id 2} {:id 1} {:id 2} {:id 3} {:id 1}] | distinct');
    expect(result).toHaveLength(3);
    const ids = result.map(m => m.get(keyword('id')));
    expect(ids).toEqual([2, 1, 3]);
  });

  it('heterogeneous Vec — mixed scalar and composite', async () => {
    const result = await evalQuery('[1 {:a 1} 1 {:a 1} "x" "x"] | distinct');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(1);
    expect(result[1].get(keyword('a'))).toBe(1);
    expect(result[2]).toBe('x');
  });
});

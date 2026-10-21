import { describe, it, expect } from 'vitest';

// Keyword / tag ordering — sort / min / max / gt / lt / gte /
// lte pairwise comparability extends to pairs of names through
// lexicographic `.name` compare, the one order of `compareValues` in
// `ordering.mjs`; these tests cover its keyword and tag branches.
describe('the one order over keywords and tags', async () => {
  it('min / max on a Keyword Vec', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    expect((await evalQuery('[:y :a :m] | min')).name).toBe('a');
    expect((await evalQuery('[:y :a :m] | max')).name).toBe('y');
  });

  it('sort keeps keywords of one name side by side', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    const result = await evalQuery('[:a :a :b] | sort');
    expect(result.map(k => k.name)).toEqual(['a', 'a', 'b']);
  });
});

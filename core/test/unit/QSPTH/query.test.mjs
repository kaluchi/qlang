import { it, expect } from 'vitest';

// `query` on a Set subject — an index in the one order, which a key
// names none of.
it('`query` over a set counts a negative index from the end', async () => {
  const { evalQuery } = await import('../../../src/session.mjs');
  expect((await evalQuery('#[:a :b :c] | query /-1')).name).toBe('c');
});

it('`query` over a set answers null for an index out of its range', async () => {
  const { evalQuery } = await import('../../../src/session.mjs');
  expect(await evalQuery('#[:a :b :c] | query /99')).toBe(null);
});

it('a key names no index of a set, and is refused read softly too', async () => {
  const { evalQuery } = await import('../../../src/session.mjs');
  const err = await evalQuery('#[:a :b] | query /x');
  expect(err.tag.name).toBe('path/IndexNotIntegerError');
});

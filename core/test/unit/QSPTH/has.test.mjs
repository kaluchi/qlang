import { it, expect } from 'vitest';

it('`has` finds a number in a set', async () => {
  const { evalQuery } = await import('../../../src/notebook.mjs');
  expect(await evalQuery('#[1 2 3] | has 2')).toBe(true);
  expect(await evalQuery('#[1 2 3] | has 9')).toBe(false);
});

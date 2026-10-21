import { describe, it, expect } from 'vitest';

describe('has over a set of values that are no keywords', async () => {
  it('finds number in Set', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    expect(await evalQuery('#[1 2 3] | has 2')).toBe(true);
    expect(await evalQuery('#[1 2 3] | has 9')).toBe(false);
  });
});

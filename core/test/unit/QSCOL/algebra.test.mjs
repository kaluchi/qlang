import { describe, it, expect } from 'vitest';

describe('minus takes off a map the keys a set of keywords names', async () => {
  it('Map×Set minus drops keys present in Set', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b]] | minus');
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('c')).toBe(true);
  });
});

describe('minus and inter over a set of keywords and other values', async () => {
  it('Map×Set minus refuses an element that names no key, under the verb of the fold', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    const result = await evalQuery('[{:a 1 :b 2}, #[:a true]] | minus !| type');
    expect(result.name).toBe('vec/minus/KeyKindNotTakenError');
  });

  it('Map×Set inter refuses an element that names no key, under the verb of the fold', async () => {
    const { evalQuery } = await import('../../../src/session.mjs');
    const result = await evalQuery('[{:a 1 :b 2 :c 3}, #[:b true]] | inter !| type');
    expect(result.name).toBe('vec/inter/KeyKindNotTakenError');
  });
});

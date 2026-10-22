import { it, expect } from 'vitest';

it('`min` and `max` rank keywords by the one order', async () => {
  const { evalQuery } = await import('../../../src/session.mjs');
  expect((await evalQuery('[:y :a :m] | min')).name).toBe('a');
  expect((await evalQuery('[:y :a :m] | max')).name).toBe('y');
});

it('sort keeps keywords of one name side by side', async () => {
  const { evalQuery } = await import('../../../src/session.mjs');
  const result = await evalQuery('[:a :a :b] | sort');
  expect(result.map(k => k.name)).toEqual(['a', 'a', 'b']);
});

import { it, expect } from 'vitest';
import { createNotebook } from '../../../src/notebook.mjs';

it('`coalesce` leaves the alternatives after the first value unrun', async () => {
  let runs = 0;
  const counting = await createNotebook({
    sources: [{
      uri: 'tests/counted',
      source: ':any/counted ::builtin{};',
      primitives: { 'any/counted': subject => { runs++; return subject; } }
    }]
  });
  expect((await counting.evalCell('{:a 1} | coalesce /a ~(counted)')).result).toBe(1);
  expect(runs).toBe(0);
  await counting.evalCell('{:a 1} | coalesce /b ~(counted)');
  expect(runs).toBe(1);
});

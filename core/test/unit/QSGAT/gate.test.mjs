import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';

it('the equality of the tests tells a set and a value under a tag from the vector and the map of no tag', async () => {
  expect(await evalQuery('#[1 2]')).not.toEqual([1, 2]);
  expect(await evalQuery('::Box{:a 1}')).not.toEqual(new Map([['a', 1]]));
  expect(await evalQuery('[#[1]]')).not.toEqual([[1]]);
});

it('the equality of the tests leaves a value of no kind and a container of one to vitest', () => {
  expect([{ start: 1 }]).toEqual([{ start: 1 }]);
  expect(makeTag('number')).toMatchObject({ name: 'number' });
});

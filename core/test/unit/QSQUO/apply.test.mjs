import { it, expect } from 'vitest';
import { makeTag } from '../../../src/types.mjs';
import { evalQuery } from '../../../src/notebook.mjs';

it('`apply` refuses text as its code, which `parse` reads first', async () => {
  expect(await evalQuery('5 | apply "add 1" !| tag')).toEqual(makeTag('any/apply/CodeKindNotTakenError'));
});

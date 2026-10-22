import { it, expect } from 'vitest';
import { makeTag } from '../../../src/types.mjs';
import { evalQuery } from '../../../src/session.mjs';

// `apply` takes a quote, a path or a function as its code, and text once
// `parse` reads it.
it('`apply` refuses text as its code, which `parse` reads first', async () => {
  expect(await evalQuery('"not-a-quote" | apply it !| type')).toEqual(makeTag('any/apply/code/KindNotTakenError'));
});

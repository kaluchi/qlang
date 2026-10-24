import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { makeKeyword, makeTag } from '../../../src/types.mjs';

it('a failure in the pipe skips raise', async () => {
  const evalResult = await evalQuery('("not-a-number" | add 1) | raise !| tag');
  expect(evalResult).toEqual(makeTag('number/add/SubjectNotNumberError'));
});

it('a verb called by `!|` runs its steps on the error at rest', async () => {
  const evalResult = await evalQuery(':any/handler ~(get /kind) | !{:kind :oops} | raise !| handler');
  expect(evalResult).toEqual(makeKeyword('oops'));
});

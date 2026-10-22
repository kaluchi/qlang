import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { isErrorValue, makeTag } from '../../../src/types.mjs';

it('`tag` hands on an error in the pipe and lays no tag over it', async () => {
  const err = await evalQuery('("not-a-number" | add 1) | tag ::Box');
  expect(isErrorValue(err)).toBe(true);
  expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
});

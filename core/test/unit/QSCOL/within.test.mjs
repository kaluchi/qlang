import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';

// [QSDSP#answer]
it('a constructor that refuses the answer of `within` refuses the edit', async () => {
  expect(await evalQuery('#[1 2] | within count !| tag'))
    .toEqual(makeTag('set/PayloadKindNotTakenError'));
});

it('an error the edit of `within` answers passes as it is', async () => {
  expect(await evalQuery('#[1 2] | within (!{:k 2} | raise) !| get /k')).toBe(2);
});

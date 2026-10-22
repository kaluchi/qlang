import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { makeTag } from '../../../src/types.mjs';

it('an address reads the verb of the root whatever the reader binds under its last name', async () => {
  expect(await evalQuery(':count 5 | get [~(::vec/count | binding | get /name) ~(::count | binding | get /value)]'))
    .toEqual(await evalQuery('[:vec/count 5]'));
});

it('an address whose kind the verb does not live on names nothing', async () => {
  expect(await evalQuery('::string/sum | doc !| type')).toEqual(makeTag('any/doc/UnknownNameError'));
});

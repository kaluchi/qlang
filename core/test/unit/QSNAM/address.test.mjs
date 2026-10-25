import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';

it('an address reads the verb of the root whatever the reader binds under its last name', async () => {
  expect(await evalQuery(':count 5 | get [~(::vec/count | binding | name) ~(::count | binding | value)]'))
    .toEqual(await evalQuery('[:vec/count 5]'));
});

it('an address whose kind the verb does not live on names nothing', async () => {
  expect(await evalQuery('::string/sum | doc !| tag')).toEqual(makeTag('any/doc/UnknownNameError'));
});

// `filter` over a map: a predicate is code applied to each value, a quote
// running against the value as its subject and reading a name of its reader
// where it runs [QSCOL#filter].

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/session.mjs';

describe('filter over a map', () => {
  it('[QSCOL#filter] runs a predicate that names a value as that value for each entry, true keeping every entry and false none', async () => {
    // The quote names a boolean, which the predicate answers for every entry.
    expect(await evalQuery('get [~(true | :n it | {:a 1 :b 2} | filter ~(n) | count) ~(false | :n it | {:a 1 :b 2} | filter ~(n) | count)]')).toEqual([2, 0]);
  });
});

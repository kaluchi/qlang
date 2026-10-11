// An unresolved name names the names nearest to it [D7]: within an edit
// distance of a third of its length, one at least, the nearest alone,
// in the order of their spelling.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword, makeTagKeyword } from '../../src/types.mjs';

const nearestOf = query => evalQuery(`${query} !| /nearest`);

describe('an unresolved name names the names nearest to it', () => {
  it('a missing letter and a swap of two neighbours are one edit each', async () => {
    expect(await nearestOf('[1 2 3] | filtr ~(gt 1)')).toEqual([keyword('filter')]);
    expect(await nearestOf('[1 2 3] | fitler ~(gt 1)')).toEqual([keyword('filter')]);
  });

  it('names at the same distance come all, in the order of their spelling', async () => {
    expect(await nearestOf('mux')).toEqual([keyword('max'), keyword('mul')]);
  });

  it('a nearer name leaves the farther ones out', async () => {
    expect(await nearestOf(':mapper 1 | :mapped 2 | mappe')).toEqual([keyword('map'), keyword('mapped'), keyword('mapper')]);
    expect(await nearestOf(':mapper 1 | :mapperXY 2 | mapper2')).toEqual([keyword('map'), keyword('mapper')]);
  });

  it('the names of the session count, a kind among them by its tag, and an address does not', async () => {
    expect(await nearestOf(':limit 3 | limti')).toEqual([keyword('limit')]);
    expect(await nearestOf(':Limit |~~ Limit. ~~| | XLimit')).toEqual([keyword('Limit')]);
    expect(await nearestOf('numbe')).toEqual([makeTagKeyword('number')]);
  });

  it('a name with nothing near holds the empty vector', async () => {
    expect(await nearestOf('zzzzqqq')).toEqual([]);
  });
});

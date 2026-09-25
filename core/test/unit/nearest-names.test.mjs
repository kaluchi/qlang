// An unresolved name names the names nearest to it [D7]: within an edit
// distance of a third of its length, one at least, the nearest alone,
// in the order of their spelling.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword } from '../../src/types.mjs';

const nearestOf = query => evalQuery(`${query} !| /nearest`);

describe('an unresolved name names the names nearest to it', () => {
  it('a missing letter and a swap of two neighbours are one edit each', async () => {
    expect(await nearestOf('[1 2 3] | filtr ~(gt 1)')).toEqual([keyword('filter')]);
    expect(await nearestOf('[1 2 3] | fitler ~(gt 1)')).toEqual([keyword('filter')]);
  });

  it('names at the same distance come all, in the order of their spelling', async () => {
    expect(await nearestOf('ab')).toEqual([keyword('as'), keyword('at')]);
  });

  it('a nearer name leaves the farther ones out', async () => {
    expect(await nearestOf(':mapper 1 | :mapped 2 | mappe')).toEqual([keyword('mapped'), keyword('mapper')]);
    expect(await nearestOf(':mapper 1 | :mapperXY 2 | mapper2')).toEqual([keyword('mapper')]);
  });

  it('the names of the session count, and tags and the keys of the runtime do not', async () => {
    expect(await nearestOf(':limit 3 | limti')).toEqual([keyword('limit')]);
    // `::Limit` lies two edits from `XLimit`, within its reach, and
    // `qlang/locator` one edit from `qlanglocator`.
    expect(await nearestOf('::Limit {} | XLimit')).toEqual([]);
    expect(await nearestOf('qlanglocator')).toEqual([]);
  });

  it('a name with nothing near holds the empty vector', async () => {
    expect(await nearestOf('zzzzqqq')).toEqual([]);
  });
});

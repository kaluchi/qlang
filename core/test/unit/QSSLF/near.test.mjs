// An unresolved name names the names near it in the order of
// their spelling: those within a slip of the hand up to a third of its
// length, one at least, the nearest of them alone; beside them the names one
// of which begins the other, three letters at least; and the names the page
// of a verb it begins with links whose names end as it goes on.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { keyword, makeTag } from '../../../src/types.mjs';

const nearestOf = query => evalQuery(`${query} !| get /nearest`);

describe('an unresolved name names the names nearest to it', () => {
  it('names at the same distance come all, in the order of their spelling', async () => {
    expect(await nearestOf('mux')).toEqual([keyword('max'), keyword('mul')]);
  });

  it('a nearer name leaves the farther ones out, a name the typed one begins with standing beside them', async () => {
    expect(await nearestOf(':mapper 1 | :mapped 2 | mappe')).toEqual([keyword('map'), keyword('mapped'), keyword('mapper')]);
    expect(await nearestOf(':mapper 1 | :mapperXY 2 | mapper2')).toEqual([keyword('map'), keyword('mapper')]);
  });

  it('the names of the session count, a label of the root among them by its tag, and an address does not', async () => {
    expect(await nearestOf(':Limit |~~ Limit. ~~| | XLimit')).toEqual([keyword('Limit')]);
    // `numbe` begins `number/add` and every other address under `number`, none of which a bare name reaches.
    expect(await nearestOf('numbe')).toEqual([makeTag('number')]);
  });

  it('follows the links of a page alone, by the tag a link opens with, past a capitalised tail', async () => {
    const twice = ':number/twice |~~ Doubles. ::snippet~(::any/sumOf | doc) ::link~(1) ::link~(::map/keys | doc) ::link~(::any/mulOf | doc) ~~| ~(mul 2) | 5';
    expect(await nearestOf(`${twice} | twiceOf`)).toEqual([keyword('mulOf'), keyword('twice')]);
    expect(await nearestOf(`${twice} | twices`)).toEqual([keyword('twice')]);
    expect(await nearestOf(`${twice} | twic`)).toEqual([keyword('twice')]);
  });

  it('follows no page of a name near by its spelling that the typed name does not begin with', async () => {
    const smooth = ':any/endX ~(1) | :number/smooth |~~ Smooths. ::link~(::any/endX | doc) ~~| ~(1) | 5';
    expect(await nearestOf(`${smooth} | smoathX`)).toEqual([keyword('smooth')]);
  });
});

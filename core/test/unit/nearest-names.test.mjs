// An unresolved name names the names nearest to it [QSSLF#near]: within an
// edit distance of a third of its length, one at least, the nearest alone, in
// the order of their spelling.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { keyword, makeTag } from '../../src/types.mjs';

const nearestOf = query => evalQuery(`${query} !| get /nearest`);

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
    expect(await nearestOf('numbe')).toEqual([makeTag('number')]);
  });

  it('a name that begins with a word and goes on in a capitalised tail names the words its page links that end in the tail [QSSLF#near]', async () => {
    expect(await nearestOf('{:x 1} | addOf (get /x) (get /x)')).toEqual([keyword('add'), keyword('sumOf')]);
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

  it('a name with nothing near holds the empty vector', async () => {
    expect(await nearestOf('zzzzqqq')).toEqual([]);
  });
});

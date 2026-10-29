import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { makeKeyword, makeTag } from '../../../src/types.mjs';

const nearestOf = query => evalQuery(`${query} !| nearest`);

it('names at the same distance come all, in the order of their spelling', async () => {
  expect(await nearestOf('mux')).toEqual([makeKeyword('max'), makeKeyword('mul')]);
});

it('a nearer name leaves the farther ones out, a name the typed one begins with standing beside them', async () => {
  expect(await nearestOf('apply ~(:mapper 1; :mapped 2; mappe)')).toEqual([makeKeyword('map'), makeKeyword('mapped'), makeKeyword('mapper')]);
  expect(await nearestOf('apply ~(:mapper 1; :mapperXY 2; mapper2)')).toEqual([makeKeyword('map'), makeKeyword('mapper')]);
});

it('the names of the notebook count, a label of the root among them by its tag, and an address does not', async () => {
  expect(await nearestOf(':Limit |~~ Limit. ~~|; XLimit')).toEqual([makeKeyword('Limit')]);
  expect(await nearestOf('numbe')).toEqual([makeTag('number'), makeKeyword('numbers')]);
});

it('a part a kind wires on its values counts among the names a step reaches, a fact of a refusal and its trace among them', async () => {
  expect(await nearestOf('"x" | add 1 !| tarce')).toEqual([makeKeyword('trace')]);
  expect(await nearestOf('"x" | add 1 !| mesage')).toEqual([makeKeyword('message')]);
});

it('follows the links of a page alone, by the tag a link opens with, past a capitalised tail', async () => {
  const twice = ':number/twice |~~ Doubles. ::snippet~(::any/sumOf | doc) ::link~(1) ::link~(::map/keys | doc) ::link~(::any/mulOf | doc) ~~| ~(mul 2); 5';
  expect(await nearestOf(`${twice} | twiceOf`)).toEqual([makeKeyword('mulOf'), makeKeyword('twice')]);
  expect(await nearestOf(`${twice} | twices`)).toEqual([makeKeyword('twice')]);
  expect(await nearestOf(`${twice} | twic`)).toEqual([makeKeyword('twice')]);
});

it('follows no page of a name near by its spelling that the typed name does not begin with', async () => {
  const smooth = ':any/endX ~(1); :number/smooth |~~ Smooths. ::link~(::any/endX | doc) ~~| ~(1); 5';
  expect(await nearestOf(`${smooth} | smoathX`)).toEqual([makeKeyword('smooth')]);
});

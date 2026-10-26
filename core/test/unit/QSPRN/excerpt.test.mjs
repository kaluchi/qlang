import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { excerptOfElements, excerptOfEntries, excerptOfText } from '../../../src/rooms.mjs';

describe('a tag tells what stands under it within the room it takes', () => {
  it('tells a vector by the elements at its two ends and its count', async () => {
    const excerpt = excerptOfElements(await evalQuery('3410 | range'), 300);
    expect([excerpt.get('count'), excerpt.get('first')[0], excerpt.get('last').at(-1), printValue(excerpt).length <= 300]).toEqual([3410, 0, 3409, true]);
  });

  it('takes the two ends by turns, an end stopping at its first element that does not fit', async () => {
    const excerpt = excerptOfElements(await evalQuery('get [1 2 3 ~(400 | range | map ~("x") | join "") 4]'), 120);
    expect([excerpt.get('count'), excerpt.get('first'), excerpt.get('last')]).toEqual([5, [1, 2, 3], [4]]);
  });

  it('tells the ends of its print where an end holds no part whole, each cut where a word ends', async () => {
    const excerpt = excerptOfEntries(await evalQuery('get {:rows ~(5000 | range) :name "x"}'), 300);
    expect([excerpt.get('count'), excerpt.get('head').startsWith('{:rows [0 1 '), excerpt.get('tail').endsWith(':name "x"}'), /\d$/.test(excerpt.get('head')), /^\d/.test(excerpt.get('tail'))]).toEqual([2, true, true, true, true]);
  });

  it('tells a map by the entries at its two ends under their keys', async () => {
    const excerpt = excerptOfEntries(await evalQuery('1000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap'), 300);
    expect([excerpt.get('count'), [...excerpt.get('first').keys()][0], [...excerpt.get('last').keys()].at(-1)]).toEqual([1000, '0k', '999k']);
  });

  it('tells a string by its first and its last characters', async () => {
    const text = await evalQuery('2000 | range | map ~(toString) | join ""');
    const excerpt = excerptOfText(text, 300);
    expect([excerpt.get('characters'), text.startsWith(excerpt.get('head')), text.endsWith(excerpt.get('tail'))]).toEqual([Array.from(text).length, true, true]);
  });

  it('tells no count where it shows every part', async () => {
    expect(printValue(excerptOfElements([1, 2, 3], 300), 0, undefined, true)).toBe('::excerpt{:first [1 2 3]}');
    expect(printValue(excerptOfText('short', 300), 0, undefined, true)).toBe('::excerpt{:head "short"}');
  });
});

describe('the excerpt a query asks for', () => {
  it('finds the excerpt of the tag of its subject by the walk of the tags', async () => {
    expect(await evalQuery('get [~([1 2 3] | excerpt | get /first | tag) ~({:a 1} | excerpt | get /first | tag) ~("s" | excerpt | keys) ~(kinds | add 1 !| trace | excerpt | keys)]')).toEqual(await evalQuery('[::vec ::map #[:head] #[:failed :subject]]'));
  });

  it('prints within the budget it takes, three hundred where it takes none and the budget of every answer at the most', async () => {
    for (const budget of [80, 120, 300, 4000]) {
      expect(printValue(await evalQuery(`3000 | range | map ~(get {:id ~(it) :name "user"}) | excerpt ${budget}`)).length, String(budget)).toBeLessThanOrEqual(budget);
    }
    expect(printValue(await evalQuery('100000 | range | excerpt 300000')).length).toBeLessThanOrEqual(16000);
  });

  it('reads back as itself', async () => {
    expect(await evalQuery('1000 | range | map ~(get {:n ~(it)}) | excerpt | :e it | print | parse | open | eq e')).toBe(true);
  });
});

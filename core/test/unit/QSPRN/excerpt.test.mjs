import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { excerptWithin } from '../../../src/rooms.mjs';

const partsOf = excerpt => excerpt.get('parts');

describe('an excerpt tells a value by its kind, its count and the parts at its two ends', () => {
  it('tells a vector by the elements at its two ends under their indices', async () => {
    const excerpt = excerptWithin(await evalQuery('3410 | range'), 300);
    expect([excerpt.get('of').name, excerpt.get('count')]).toEqual(['vec', 3410]);
    const indices = [...partsOf(excerpt).keys()];
    expect([indices[0], indices.at(-1)]).toEqual(['0', '3409']);
    expect([...partsOf(excerpt)].every(([index, part]) => Number(index) === part)).toBe(true);
  });

  it('takes the two ends by turns, an end stopping at its first part that does not fit', async () => {
    const excerpt = excerptWithin(await evalQuery('get [1 2 3 ~(400 | range | map ~("x") | join "")]'), 120);
    expect([...partsOf(excerpt).keys()]).toEqual(['0', '1', '2']);
  });

  it('shows a map under its keys', async () => {
    const excerpt = excerptWithin(await evalQuery('1000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap'), 300);
    expect([excerpt.get('of').name, excerpt.get('count'), [...partsOf(excerpt).keys()][0]]).toEqual(['map', 1000, '0k']);
  });

  it('tells a string by its first and its last characters under their offsets, which drop reads to them', async () => {
    const text = await evalQuery('2000 | range | map ~(toString) | join ""');
    const excerpt = excerptWithin(text, 300);
    const shown = [...partsOf(excerpt)];
    expect([excerpt.get('count'), shown.length, shown[0][0]]).toEqual([Array.from(text).length, 2, '0']);
    expect(shown.every(([offset, characters]) => text.slice(Number(offset)).startsWith(characters))).toBe(true);
    expect(text.endsWith(shown[1][1])).toBe(true);
  });

  it('tells a value its kind prints by the text of that print', async () => {
    const excerpt = await evalQuery(':Box |~~ B ~~| | :Box/print ~(400 | range | map ~("b") | join "") | ::Box[1] | excerpt 100');
    expect([excerpt.get('of').name, excerpt.get('count')]).toEqual(['Box', 400]);
    expect([...partsOf(excerpt).values()].every(text => /^b+$/.test(text))).toBe(true);
  });

  it('shows a value that fits whole', async () => {
    expect(printValue(await evalQuery('[1 2] | excerpt'))).toBe('::excerpt{\n  :of ::vec\n  :count 2\n  :parts {:"0" 1 :"1" 2}\n}');
  });
});

describe('the excerpt a query asks for', () => {
  it('prints within the budget it takes, three hundred where it takes none', async () => {
    for (const budget of [80, 120, 300, 4000]) {
      expect(printValue(await evalQuery(`3000 | range | map ~(get {:id ~(it) :name "user"}) | excerpt ${budget}`)).length, String(budget)).toBeLessThanOrEqual(budget);
    }
    expect(printValue(await evalQuery('3000 | range | excerpt')).length).toBeLessThanOrEqual(300);
  });

  it('answers the count of the value told by count, and no verb of that value', async () => {
    expect(await evalQuery('3410 | range | excerpt | get [~(count) ~(of)]')).toEqual([3410, (await evalQuery('::vec'))]);
    expect((await evalQuery('3410 | range | excerpt | take 3 !| tag')).name).toBe('call/KindAnswersNoVerbError');
  });

  it('refuses a budget past the budget of every answer, naming that budget', async () => {
    expect(await evalQuery('[1 2] | excerpt 300000 !| get [~(tag) ~(budget) ~(actualValue)]')).toEqual([await evalQuery('::any/excerpt/budget/PastTheBudgetError'), 16000, 300000]);
  });

  it('reads back as itself', async () => {
    expect(await evalQuery('1000 | range | map ~(get {:n ~(it)}) | excerpt | :e it | print | parse | open | eq e')).toBe(true);
  });
});

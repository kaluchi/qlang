import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';

describe('the names of the scope', () => {
  it('a bare name reads a value a source of the root declares, and no label of the root', async () => {
    const notebook = await createNotebook({ sources: [{
      uri: 'shop',
      source: ':shop |~~ A shop. ~~|\n:limit 5'
    }] });
    expect((await notebook.evalCell('limit')).result).toBe(5);
    expect((await notebook.evalCell('shop !| type')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a verb of a source reads a bare value of the root as a reader reads it, after the verbs of its name, no scope of its source before them', async () => {
    const shop = { uri: 'shop', source: ':shop |~~ A shop. ~~|\n:limit 5\n:shop/capped ~(limit)' };
    const later = { uri: 'stock', source: ':stock |~~ A stock. ~~|\n:stock/limit ~(7)' };
    const alone = await createNotebook({ sources: [shop] });
    expect((await alone.evalCell(':vec/limit ~(99) | ::shop{} | capped')).result).toBe(5);
    const beside = await createNotebook({ sources: [shop, later] });
    expect((await beside.evalCell('::shop{} | capped !| type')).result).toEqual(makeTag('stock/limit/SubjectNotStockError'));
  });

  it('a label of a source is no bare name inside the verbs of its source', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|\n:shop/self ~(shop)' }] });
    expect((await notebook.evalCell('::shop{} | self !| type')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a verb of a source reads a bare value its source declares after it, a node of the root', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|\n:shop/capped ~(limit)\n:limit 5' }] });
    expect((await notebook.evalCell('::shop{} | capped')).result).toBe(5);
  });

  it('a value of the reader meets a verb a later source declares, where the subject answers the verb alone', async () => {
    const later = { uri: 'stock', source: ':vec/tally ~(count)' };
    const alone = await createNotebook({ sources: [] });
    expect((await alone.evalCell(':tally 5 | [1 2] | tally')).result).toBe(5);
    const beside = await createNotebook({ sources: [later] });
    const met = ':tally 5 | get [~(7 | tally) ~([1 2] | tally !| get [~(type) /addresses]) ~([1 2] | vec/tally)]';
    expect((await beside.evalCell(`${met} | eq [5 [::call/ValueMeetsVerbError #[::vec/tally]] 2]`)).result).toBe(true);
  });

  it('a value of the reader meets a verb of a later source only where the verb serves the subject, its tag name among them', async () => {
    const later = { uri: 'shop', source: ':Shop |~~ A shop. ~~|\n:Shop/f ~(1)\n:Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9 to 5"))' };
    const notebook = await createNotebook({ sources: [later] });
    const met = ':f 7 | :hours 3 | get [~(::Shop | f) ~(::Shop{} | f !| type) ~(::Shop | hours !| type)]';
    expect((await notebook.evalCell(`${met} | eq [7 ::call/ValueMeetsVerbError ::call/ValueMeetsVerbError]`)).result).toBe(true);
  });

  it('a reader\'s verb on a label meets a value of its name only on a subject it serves', async () => {
    const reader = ':Shop |~~ A shop. ~~| | :Shop/f ~(1) | :f 7';
    expect(await evalQuery(`${reader} | get [~(::Shop | f) ~(::Shop{} | f !| type) ~(5 | f)] | eq [7 ::call/ValueMeetsVerbError 7]`)).toBe(true);
  });
});

it('an input of `subOf` and `divOf` meets a verb of its name that serves the subject, the reader\'s under a kind of its own and a later source\'s', async () => {
  const post = ':Post |~~ A post. ~~| | :Post/minuend ~(1) | ::Post{:a 6 :b 2}';
  expect(await evalQuery(`${post} | subOf /a /b !| get [~(type) /name] | eq [::call/ValueMeetsVerbError :minuend]`)).toBe(true);
  const notebook = await createNotebook({ sources: [{ uri: 'later', source: ':map/divisor ~(1)' }] });
  expect((await notebook.evalCell('{:a 6 :b 2} | divOf /a /b !| get [~(type) /name] | eq [::call/ValueMeetsVerbError :divisor]')).result).toBe(true);
});

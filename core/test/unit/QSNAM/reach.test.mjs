import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';

describe('the names of the scope', () => {
  it('a bare name reads no label of the root', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|;' }] });
    expect((await notebook.evalCell('shop !| tag')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a verb of a source reads a bare name as a reader reads it, the one verb of its name a later source declares among them', async () => {
    const shop = { uri: 'shop', source: ':shop |~~ A shop. ~~|;\n:shop/capped limit;' };
    const later = { uri: 'stock', source: ':stock |~~ A stock. ~~|;\n:stock/limit ~(7);' };
    const alone = await createNotebook({ sources: [shop] });
    expect((await alone.evalCell('::shop{} | capped !| tag')).result).toEqual(makeTag('call/UnknownNameError'));
    const beside = await createNotebook({ sources: [shop, later] });
    expect((await beside.evalCell('::shop{} | capped !| tag')).result).toEqual(makeTag('stock/limit/SubjectNotStockError'));
  });

  it('a label of a source is no bare name inside the verbs of its source', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|;\n:shop/self ~(shop);' }] });
    expect((await notebook.evalCell('::shop{} | self !| tag')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a verb of a source reads a verb its source declares after it, a node of the root', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|;\n:shop/capped limit;\n:shop/limit ~(5);' }] });
    expect((await notebook.evalCell('::shop{} | capped')).result).toBe(5);
  });

  it('a value of the reader stands over a verb a later source declares, which its address calls, a later step refusing the name', async () => {
    const later = { uri: 'stock', source: ':vec/tally count;' };
    const beside = await createNotebook({ sources: [later] });
    const read = '[1 2] | with {:tally (5)} (get [tally vec/tally (reverse | tally !| get [tag addresses])])';
    expect((await beside.evalCell(`${read} | eq [5 2 [::call/ValueAsALaterStepError #[::vec/tally]]]`)).result).toBe(true);
  });

  it('a value of the reader stands over a verb of a later source whatever the subject, a verb of its tag name among them', async () => {
    const later = { uri: 'shop', source: ':Shop |~~ A shop. ~~|;\n:Shop/f ~(1);\n:Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9 to 5"));' };
    const notebook = await createNotebook({ sources: [later] });
    const read = 'get [(::Shop | with {:f (7)} f) (::Shop{} | with {:f (7)} f) (::Shop | with {:hours (3)} hours)]';
    expect((await notebook.evalCell(`${read} | eq [7 7 3]`)).result).toBe(true);
  });

  it('a value of the reader stands over a reader\'s verb on a label whatever the subject, the verb called by its address', async () => {
    const reader = ':Shop |~~ A shop. ~~|; :Shop/f ~(1); get [(::Shop | with {:f (7)} f) (::Shop{} | with {:f (7)} (get [f Shop/f])) (5 | with {:f (7)} f)]';
    expect(await evalQuery(`${reader} | eq [7 [7 1] 7]`)).toBe(true);
  });
});

it('an input of `subOf` and `divOf` is read past a verb of its name that serves the subject, the reader\'s under a kind of its own and a later source\'s', async () => {
  const post = ':Post |~~ A post. ~~|; :Post/minuend ~(1); ::Post{:a 6 :b 2}';
  expect(await evalQuery(`${post} | subOf /a /b | eq 4`)).toBe(true);
  const notebook = await createNotebook({ sources: [{ uri: 'later', source: ':map/divisor ~(1);' }] });
  expect((await notebook.evalCell('{:a 6 :b 2} | divOf /a /b | eq 3')).result).toBe(true);
});

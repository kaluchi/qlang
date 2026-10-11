// The names of a scope [D153]: the nouns of the root and the reader's
// own, the nodes a name with a path declares under its noun, and the
// address that reads one.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { makeTag } from '../../src/types.mjs';

describe('the names of the scope', () => {
  it('env holds what the reader declared, and kinds the labels of one segment, a topic among them [D160], [D169]', async () => {
    expect(await evalQuery('env | eq {}')).toBe(true);
    expect(await evalQuery('kinds | [(has ::number) (has ::qlang) (has ::number/add/SubjectNotNumberError)]'))
      .toEqual([true, true, false]);
  });

  it('a kind the reader declares is a name of its scope', async () => {
    expect(await evalQuery(':Box |~~ A box. ~~| | env | has :Box')).toBe(true);
  });

  it('a noun answers the nodes declared one name under it', async () => {
    const session = await createSession({ sources: [{
      uri: 'shop',
      source: ':shop |~~ A shop. ~~|\n:shop/Order |~~ An order. ~~|\n:shop/Line |~~ A line. ~~|\n:shop/Line/qty ~(1)'
    }] });
    expect([...(await session.evalCell('::shop | manifest')).result])
      .toEqual([makeTag('shop/Line'), makeTag('shop/Order')]);
    expect([...await evalQuery('::qlang/values | manifest')]).toEqual([]);
  });

  it('a bare name reads a value a source of the root declares, and no label of the root [D191]', async () => {
    const session = await createSession({ sources: [{
      uri: 'shop',
      source: ':shop |~~ A shop. ~~|\n:limit 5'
    }] });
    expect((await session.evalCell('limit')).result).toBe(5);
    expect((await session.evalCell('shop !| type')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a word of a source reads a bare value of its source before a word of that name a reader or a later source declares [D200]', async () => {
    const shop = { uri: 'shop', source: ':shop |~~ A shop. ~~|\n:limit 5\n:shop/capped ~(limit)' };
    const later = { uri: 'stock', source: ':stock |~~ A stock. ~~|\n:stock/limit ~(7)' };
    const alone = await createSession({ sources: [shop] });
    expect((await alone.evalCell(':vec/limit ~(99) | ::shop{} | capped')).result).toBe(5);
    const beside = await createSession({ sources: [shop, later] });
    expect((await beside.evalCell('::shop{} | capped')).result).toBe(5);
  });

  it('a label of a source is no bare name inside the words of its source [D191], [D200]', async () => {
    const session = await createSession({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|\n:shop/self ~(shop)' }] });
    expect((await session.evalCell('::shop{} | self !| type')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a word of a source reads a bare value its source declares after it [D200]', async () => {
    const session = await createSession({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|\n:shop/capped ~(limit)\n:limit 5' }] });
    expect((await session.evalCell('::shop{} | capped')).result).toBe(5);
  });
});

describe('the verbs that live on a kind', () => {
  it('a kind lists by address the verbs declared under it, and any value lists its own', async () => {
    expect(await evalQuery('::number | manifest | has ::number/add')).toBe(true);
    expect(await evalQuery('::any | manifest | has ::any/doc')).toBe(true);
    expect(await evalQuery('::string | manifest | has ::string/doc')).toBe(false);
  });

  it('an address the listing answers leads the axes to its name', async () => {
    expect(await evalQuery('[::number/gt ::number/lt] | map ~manifest | eq [#[::number/gt/answer ::number/gt/value] #[::number/lt/answer ::number/lt/value]]')).toBe(true);
  });

  it('a verb of any tagged value lives on the kind of tagged values', async () => {
    expect(await evalQuery('::tagged | manifest | has ::tagged/within')).toBe(true);
  });

  it('a host verb declared under a kind serves its values beneath a tag', async () => {
    const session = await createSession({ sources: [{
      uri: 'tests/typed',
      source: ':string/shout ::builtin{}',
      impls: { 'string/shout': text => text.toUpperCase() }
    }] });
    expect((await session.evalCell('::Box("hi") | shout')).result).toBe('HI');
  });
});

describe('an address reads the node its name declared', () => {
  it('an address with a kind reads the verb declared under that kind', async () => {
    expect(await evalQuery('::vec/count | doc | type')).toEqual(makeTag('doc'));
    expect(await evalQuery('::vec/count | source | parse | startsWith ":vec/count"')).toBe(true);
    expect(await evalQuery('::vec/count | laws | count | gt 0')).toBe(true);
    expect(await evalQuery('::vec/count | binding | /value | type')).toEqual(makeTag('builtin'));
  });

  it('a verb has no address of its own, only through the noun it lives on', async () => {
    expect(await evalQuery('::count | doc !| type')).toEqual(makeTag('any/doc/UnknownNameError'));
  });

  it('an address reads the root\'s verb whatever the scope binds', async () => {
    expect(await evalQuery(':limit 5 | ::vec/count | doc | content | contains "number of elements"'))
      .toBe(true);
  });

  it('an address whose kind the verb does not live on names nothing', async () => {
    expect(await evalQuery('::string/sum | doc !| type')).toEqual(makeTag('any/doc/UnknownNameError'));
    expect(await evalQuery('::nowhere/nothing | binding !| type')).toEqual(makeTag('any/binding/UnknownNameError'));
  });

  it('a value whose tag no node answers reads no page', async () => {
    expect((await evalQuery('::Box#[3 1] | doc')).tag.name).toBe('any/doc/UnknownNameError');
  });
});

describe('a name with a path calls the verb its address names', () => {
  it('calls the verb its address names, with the modifiers the call takes', async () => {
    expect(await evalQuery('[1 2 3] | vec/count')).toBe(3);
    expect(await evalQuery('[1 2 3] | vec/filter ~(gt 1)')).toEqual([2, 3]);
  });

  it('an address that names no verb is refused with the address', async () => {
    expect(await evalQuery('[1 2 3] | vec/nothing !| /address')).toEqual(makeTag('vec/nothing'));
  });
});

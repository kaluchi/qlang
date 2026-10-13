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
    expect(await evalQuery('kinds | get [(has ::number) (has ::qlang) (has ::number/add/SubjectNotNumberError)]'))
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

  it('a body declares none of the names its call binds whatever a reader or a later source names so, and shadows every other [D71]', async () => {
    const shop = { uri: 'shop', source: ':vec/sized ~(:n 3 | n)\n:vec/sized/n /0\n:vec/scaled ~(map ~(mul n))\n:vec/scaled/n /0\n:vec/padded ~(:n 3 | count | add n)' };
    const later = { uri: 'stock', source: ':n 9' };
    const session = await createSession({ sources: [shop, later] });
    const answers = ':n 7 | [([1] | sized 2 !| [type (get /name)]) ([1 2] | scaled 2) ([1 2] | padded)]';
    expect((await session.evalCell(`${answers} | eq [[::bind/NameDeclaredTwiceError :n] [2 4] 5]`)).result).toBe(true);
    const reader = ':n 7 | :vec/twice ~(:n 2 | map ~(mul n)) | :vec/sum2 ~(:n 2 | sum | add n) | :vec/sum2/n /0';
    expect((await session.evalCell(`${reader} | get [([1 2] | twice) ([1 2] | sum2 5 !| [type (get /name)])] | eq [[2 4] [::bind/NameDeclaredTwiceError :n]]`)).result).toBe(true);
  });

  it('a value of the reader meets a word a later source declares, where the subject answers the word alone [D223]', async () => {
    const later = { uri: 'stock', source: ':vec/tally ~(count)' };
    const alone = await createSession({ sources: [] });
    expect((await alone.evalCell(':tally 5 | [1 2] | tally')).result).toBe(5);
    const beside = await createSession({ sources: [later] });
    const met = ':tally 5 | [(7 | tally) ([1 2] | tally !| [type (get /addresses)]) ([1 2] | vec/tally)]';
    expect((await beside.evalCell(`${met} | eq [5 [::call/ValueMeetsWordError #[::vec/tally]] 2]`)).result).toBe(true);
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
    expect(await evalQuery('::vec/count | binding | get /value | type')).toEqual(makeTag('builtin'));
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
    expect(await evalQuery('[1 2 3] | vec/nothing !| get /address')).toEqual(makeTag('vec/nothing'));
  });
});

describe('what a word reads and runs as data reads the tree of the query [D200]', () => {
  const pages = { uri: 'pages', source: ':pages |~~ Pages. ~~|\n:k |~~ the source\'s own ~~| 1\n:any/pageOf ~(doc | content)' };
  const runner = { uri: 'runner', source: ':runner |~~ A runner. ~~|\n:any/runIt ~(apply code)\n:any/runIt/code /0\n:any/runIt/x /1' };

  it('a word of the root reads the page and the laws of a bare name the reader declares', async () => {
    expect(await evalQuery(':k |~~ Answers five. ~~| 5 | :k/answersFive |~~ k answers five. ~~| ::law~(k | eq 5) | ::k | tutorial | get [(get /0 | content) (get /1 | keys)] | eq [" Answers five. " #[:answersFive]]')).toBe(true);
  });

  it('a value of the reader reaches no name the body of a word of the root writes', async () => {
    expect(await evalQuery(':laws 7 | :k |~~ K. ~~| 1 | ::k | tutorial | get [(get /0 | content) (get /1)] | eq [" K. " {}]')).toBe(true);
  });

  it('the names a word of the root declares stay out of what it reads as data', async () => {
    expect(await evalQuery('[(::subject | tutorial !| type) (:subject |~~ mine ~~| 1 | ::subject | tutorial | first | content)] | eq [::any/doc/UnknownNameError " mine "]')).toBe(true);
  });

  it('a word of a source reads the reader\'s name before the source\'s own, and the source\'s where the reader declares none', async () => {
    const session = await createSession({ sources: [pages] });
    expect((await session.evalCell('::k | pageOf')).result).toBe(' the source\'s own ');
    expect((await session.evalCell(':k |~~ the reader\'s ~~| 2 | ::k | pageOf')).result).toBe(' the reader\'s ');
  });

  it('a word of a source reads a name a later source declares, under the reader\'s', async () => {
    const reading = { uri: 'reading', source: ':reading |~~ Reading. ~~|\n:any/pageOf ~(doc | content)' };
    const later = { uri: 'later', source: ':later |~~ Later. ~~|\n:k |~~ the later source\'s ~~| 3' };
    const session = await createSession({ sources: [reading, later] });
    expect((await session.evalCell('::k | pageOf')).result).toBe(' the later source\'s ');
    expect((await session.evalCell(':k |~~ the reader\'s ~~| 2 | ::k | pageOf')).result).toBe(' the reader\'s ');
  });

  it('code held as data runs in the tree of the query, past the parts of a word of the root', async () => {
    const session = await createSession({ sources: [runner] });
    expect((await session.evalCell(':x 1 | "x" | parse | :q it | null | runIt q 99')).result).toBe(1);
  });

  it('a word the reader declares reads and runs as data under its own declarations, as steps inline in a group', async () => {
    expect(await evalQuery(':x 1 | :any/names ~(:y 2 | env | get [(has :y) (has :x)]) | names | eq [true true]')).toBe(true);
    expect(await evalQuery(':any/f ~(:loc |~~ L ~~| 1 | ::loc | doc | content) | f')).toBe(' L ');
    expect(await evalQuery(':x 1 | :any/run ~(apply code) | :any/run/code /0 | :any/run/x /1 | "x" | parse | :q it | null | run q 99')).toBe(99);
  });

  it('a word reads a name the query declares after the word', async () => {
    expect(await evalQuery(':any/pageOf ~(doc | content) | :k |~~ K. ~~| 1 | ::k | pageOf')).toBe(' K. ');
    expect(await evalQuery(':any/run ~(apply code) | :any/run/code /0 | :x 5 | "x | add 1" | parse | :q it | null | run q')).toBe(6);
  });
});

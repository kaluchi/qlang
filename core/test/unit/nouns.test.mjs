// The names of a scope [QSDSP#residence]: the nouns of the root and the
// reader's own, the nodes a name with a path declares under its noun, and the
// address that reads one.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { keyword, makeTag } from '../../src/types.mjs';

describe('the names of the scope', () => {
  it('env holds what the reader declared, and kinds the labels of one segment, a topic among them [QSNAM#binding], [QSSLF#catalog]', async () => {
    expect(await evalQuery('env | eq {}')).toBe(true);
    expect(await evalQuery('kinds | get [~(has ::number) ~(has ::qlang) ~(has ::number/add/SubjectNotNumberError)]'))
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

  it('a bare name reads a value a source of the root declares, and no label of the root [QSDSP#residence]', async () => {
    const session = await createSession({ sources: [{
      uri: 'shop',
      source: ':shop |~~ A shop. ~~|\n:limit 5'
    }] });
    expect((await session.evalCell('limit')).result).toBe(5);
    expect((await session.evalCell('shop !| type')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a verb of a source reads a bare value of the root as a reader reads it, after the verbs of its name, no scope of its source before them [QSNAM#reach]', async () => {
    const shop = { uri: 'shop', source: ':shop |~~ A shop. ~~|\n:limit 5\n:shop/capped ~(limit)' };
    const later = { uri: 'stock', source: ':stock |~~ A stock. ~~|\n:stock/limit ~(7)' };
    const alone = await createSession({ sources: [shop] });
    expect((await alone.evalCell(':vec/limit ~(99) | ::shop{} | capped')).result).toBe(5);
    const beside = await createSession({ sources: [shop, later] });
    expect((await beside.evalCell('::shop{} | capped !| type')).result).toEqual(makeTag('stock/limit/SubjectNotStockError'));
  });

  it('a label of a source is no bare name inside the verbs of its source [QSNAM#reach]', async () => {
    const session = await createSession({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|\n:shop/self ~(shop)' }] });
    expect((await session.evalCell('::shop{} | self !| type')).result).toEqual(makeTag('call/UnknownNameError'));
  });

  it('a verb of a source reads a bare value its source declares after it, a node of the root [QSNAM#reach]', async () => {
    const session = await createSession({ sources: [{ uri: 'shop', source: ':shop |~~ A shop. ~~|\n:shop/capped ~(limit)\n:limit 5' }] });
    expect((await session.evalCell('::shop{} | capped')).result).toBe(5);
  });

  it('a recipe declares none of the inputs its call binds whatever a reader or a later source names so, and shadows every other [QSNAM#scope]', async () => {
    const shop = { uri: 'shop', source: ':vec/sized (::fn | takes :n |~~ N. ~~| /0 | impl ~(:n 3 | n))\n:vec/scaled (::fn | takes :n |~~ N. ~~| /0 | impl ~(map ~(mul n)))\n:vec/padded ~(:n 3 | count | add n)' };
    const later = { uri: 'stock', source: ':n 9' };
    const session = await createSession({ sources: [shop, later] });
    const answers = ':n 7 | get [~([1] | sized 2 !| get [~(type) /name]) ~([1 2] | scaled 2) ~([1 2] | padded)]';
    expect((await session.evalCell(`${answers} | eq [[::bind/NameDeclaredTwiceError :n] [2 4] 5]`)).result).toBe(true);
    const reader = ':n 7 | :vec/twice ~(:n 2 | map ~(mul n)) | :vec/sum2 (::fn | takes :n |~~ N. ~~| /0 | impl ~(:n 2 | sum | add n))';
    expect((await session.evalCell(`${reader} | get [~([1 2] | twice) ~([1 2] | sum2 5 !| get [~(type) /name])] | eq [[2 4] [::bind/NameDeclaredTwiceError :n]]`)).result).toBe(true);
  });

  it('a value of the reader meets a verb a later source declares, where the subject answers the verb alone [QSNAM#reach]', async () => {
    const later = { uri: 'stock', source: ':vec/tally ~(count)' };
    const alone = await createSession({ sources: [] });
    expect((await alone.evalCell(':tally 5 | [1 2] | tally')).result).toBe(5);
    const beside = await createSession({ sources: [later] });
    const met = ':tally 5 | get [~(7 | tally) ~([1 2] | tally !| get [~(type) /addresses]) ~([1 2] | vec/tally)]';
    expect((await beside.evalCell(`${met} | eq [5 [::call/ValueMeetsVerbError #[::vec/tally]] 2]`)).result).toBe(true);
  });

  it('a value of the reader meets a verb of a later source only where the verb serves the subject, its tag name among them [QSNAM#reach]', async () => {
    const later = { uri: 'shop', source: ':Shop |~~ A shop. ~~|\n:Shop/f ~(1)\n:Shop/hours (::fn | on |~~ The shop. ~~| ::tag | impl ~("9 to 5"))' };
    const session = await createSession({ sources: [later] });
    const met = ':f 7 | :hours 3 | get [~(::Shop | f) ~(::Shop{} | f !| type) ~(::Shop | hours !| type)]';
    expect((await session.evalCell(`${met} | eq [7 ::call/ValueMeetsVerbError ::call/ValueMeetsVerbError]`)).result).toBe(true);
  });

  it('a reader\'s verb on a label meets a value of its name only on a subject it serves [QSNAM#reach]', async () => {
    const reader = ':Shop |~~ A shop. ~~| | :Shop/f ~(1) | :f 7';
    expect(await evalQuery(`${reader} | get [~(::Shop | f) ~(::Shop{} | f !| type) ~(5 | f)] | eq [7 ::call/ValueMeetsVerbError 7]`)).toBe(true);
  });
});

describe('a recipe of the root reads its verbs and its inputs by name [QSBLD#recipe]', () => {
  it('a name of habit answers as its verb on the subject, a reader\'s verb under a noun of the root staying in the reader\'s queries [QSNAM#owner]', async () => {
    expect(await evalQuery(':number/tag ~(99) | 5 | get [~(desc) ~(tag ::desc !| type)] | eq [::desc#5 ::number/tag/ArgsBeyondInputsError]')).toBe(true);
  });

  it('a name of habit answers as its verb on a value of a kind the reader declared, a verb of the reader under it among them [QSNAM#owner]', async () => {
    const post = ':Post |~~ A post. ~~| | :Post/tag ~(get /tag) | ::Post{:tag "a"}';
    expect(await evalQuery(`${post} | get [~(desc !| type) ~(tag ::desc !| type)] | eq [::Post/tag/ArgsBeyondInputsError ::Post/tag/ArgsBeyondInputsError]`)).toBe(true);
    const box = ':Box |~~ A box. ~~| | :Box/toSet ~(#[9]) | ::Box[2 1 2]';
    expect(await evalQuery(`${box} | get [~(distinct) ~(toSet)] | eq [#[9] #[9]]`)).toBe(true);
  });

  it('a name of habit answers as its verb under a verb a later source declares', async () => {
    const session = await createSession({ sources: [{ uri: 'later', source: ':number/tag (::fn | impl ~(99))' }] });
    expect((await session.evalCell('5 | get [~(desc !| type) ~(tag ::desc !| type)] | eq [::number/tag/ArgsBeyondInputsError ::number/tag/ArgsBeyondInputsError]')).result).toBe(true);
  });

  it('the inputs of `subOf` and `divOf` shadow a value of the reader of their names, and a verb under a noun of the root stays in the reader\'s queries [QSBLD#recipe], [QSNAM#owner]', async () => {
    const reader = ':minuend 1 | :divisor 1 | :map/subtrahend ~(1) | :map/dividend ~(1)';
    expect(await evalQuery(`${reader} | {:a 6 :b 2} | get [~(subOf /a /b) ~(divOf /a /b)] | eq [4 3]`)).toBe(true);
  });

  it('an input of `subOf` and `divOf` meets a verb of its name that serves the subject, the reader\'s under a kind of its own and a later source\'s [QSNAM#reach]', async () => {
    const post = ':Post |~~ A post. ~~| | :Post/minuend ~(1) | ::Post{:a 6 :b 2}';
    expect(await evalQuery(`${post} | subOf /a /b !| get [~(type) /name] | eq [::call/ValueMeetsVerbError :minuend]`)).toBe(true);
    const session = await createSession({ sources: [{ uri: 'later', source: ':map/divisor ~(1)' }] });
    expect((await session.evalCell('{:a 6 :b 2} | divOf /a /b !| get [~(type) /name] | eq [::call/ValueMeetsVerbError :divisor]')).result).toBe(true);
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
      primitives: { 'string/shout': text => text.toUpperCase() }
    }] });
    expect((await session.evalCell('::Box"hi" | shout')).result).toBe('HI');
  });
});

describe('an address reads the node its name declared', () => {
  it('an address with a kind reads the verb declared under that kind', async () => {
    expect(await evalQuery('::vec/count | doc | type')).toEqual(makeTag('doc'));
    expect(await evalQuery('::vec/count | source | toString | startsWith ":vec/count"')).toBe(true);
    expect(await evalQuery('::vec/count | laws | count | gt 0')).toBe(true);
    expect(await evalQuery('::vec/count | binding | get /value | type')).toEqual(makeTag('fn'));
  });

  it('a name has no address of its own, only through the noun each of its verbs lives on', async () => {
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

  it('a value whose tag no node answers reads the page of the kind beneath it [QSSLF#axis]', async () => {
    expect(await evalQuery('::Box#[3 1] | doc | eq (::set | doc)')).toBe(true);
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

describe('what a verb reads and runs as data reads the tree of the query [QSNAM#owner]', () => {
  const pages = { uri: 'pages', source: ':pages |~~ Pages. ~~|\n:k |~~ the source\'s own ~~| 1\n:any/pageOf ~(doc | content)' };
  const runner = { uri: 'runner', source: ':runner |~~ A runner. ~~|\n:any/runIt (::fn | takes :code |~~ The code. ~~| /0 | takes :x |~~ An x. ~~| /1 | impl ~(apply code))' };

  it('a verb of the root reads the page and the laws of a bare name the reader declares', async () => {
    expect(await evalQuery(':k |~~ Answers five. ~~| 5 | :k/answersFive |~~ k answers five. ~~| ::law~(k | eq 5) | ::k | tutorial | get [~(get /0 | content) ~(get /1 | keys)] | eq [" Answers five. " #[:answersFive]]')).toBe(true);
  });

  it('a value of the reader reaches no name the recipe of a verb of the root writes', async () => {
    expect(await evalQuery(':laws 7 | :k |~~ K. ~~| 1 | ::k | tutorial | get [~(get /0 | content) /1] | eq [" K. " {}]')).toBe(true);
  });

  it('the names a verb of the root declares stay out of what it reads as data', async () => {
    expect(await evalQuery('get [~(::subject | tutorial !| type) ~(:subject |~~ mine ~~| 1 | ::subject | tutorial | first | content)] | eq [::any/doc/UnknownNameError " mine "]')).toBe(true);
  });

  it('a verb of a source reads the reader\'s name before the source\'s own, and the source\'s where the reader declares none', async () => {
    const session = await createSession({ sources: [pages] });
    expect((await session.evalCell('::k | pageOf')).result).toBe(' the source\'s own ');
    expect((await session.evalCell(':k |~~ the reader\'s ~~| 2 | ::k | pageOf')).result).toBe(' the reader\'s ');
  });

  it('a verb of a source reads a name a later source declares, under the reader\'s', async () => {
    const reading = { uri: 'reading', source: ':reading |~~ Reading. ~~|\n:any/pageOf ~(doc | content)' };
    const later = { uri: 'later', source: ':later |~~ Later. ~~|\n:k |~~ the later source\'s ~~| 3' };
    const session = await createSession({ sources: [reading, later] });
    expect((await session.evalCell('::k | pageOf')).result).toBe(' the later source\'s ');
    expect((await session.evalCell(':k |~~ the reader\'s ~~| 2 | ::k | pageOf')).result).toBe(' the reader\'s ');
  });

  it('code held as data reads no value of the reader, past the inputs of a verb of the root [QSQUO#held]', async () => {
    const session = await createSession({ sources: [runner] });
    expect((await session.evalCell(':x 1 | "x" | parse | :q it | null | runIt q 99 !| get [~(type) /name]')).result)
      .toEqual([makeTag('call/ValueWithheldError'), keyword('x')]);
  });

  it('a verb the reader declares reads as data the tree of the query, past its own declarations, and runs held code in a lane of its own [QSNAM#owner]', async () => {
    expect(await evalQuery(':x 1 | :any/names ~(:y 2 | env | get [~(has :y) ~(has :x)]) | names | eq [false true]')).toBe(true);
    expect(await evalQuery(':any/f ~(:loc |~~ L ~~| 1 | ::loc | doc | content) | f !| type')).toEqual(makeTag('any/doc/UnknownNameError'));
    expect(await evalQuery(':x 1 | :any/run (::fn | takes :code |~~ The code. ~~| /0 | takes :x |~~ An x. ~~| /1 | impl ~(apply code)) | "x" | parse | :q it | null | run q 99 !| type'))
      .toEqual(makeTag('call/ValueWithheldError'));
  });

  it('a verb reads as data a name the query declares after the verb, and held code reads no value', async () => {
    expect(await evalQuery(':any/pageOf ~(doc | content) | :k |~~ K. ~~| 1 | ::k | pageOf')).toBe(' K. ');
    expect(await evalQuery(':any/run (::fn | takes :code |~~ The code. ~~| /0 | impl ~(apply code)) | :x 5 | "x | add 1" | parse | :q it | null | run q !| type'))
      .toEqual(makeTag('call/ValueWithheldError'));
  });

  it('held code reads a verb a later source declares, and the reader\'s verb that shadows it [QSQUO#held]', async () => {
    const later = { uri: 'later', source: ':any/triple ~(mul 3)' };
    const session = await createSession({ sources: [later] });
    expect((await session.evalCell(':f ~(triple) | 2 | apply f')).result).toBe(6);
    expect((await session.evalCell(':number/triple ~(mul 30) | :g ~(triple) | 2 | apply g')).result).toBe(60);
  });

  it('a value of the reader that shadows a value of the root is withheld from held code, which the root\'s does not answer for [QSQUO#held]', async () => {
    const host = { uri: 'host', source: ':pi 3' };
    const session = await createSession({ sources: [host] });
    expect((await session.evalCell(':f ~(pi) | apply f')).result).toBe(3);
    expect((await session.evalCell(':pi 4 | :f ~(pi) | apply f !| type')).result).toEqual(makeTag('call/ValueWithheldError'));
  });
});

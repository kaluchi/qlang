import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { makeTag } from '../../../src/types.mjs';

describe('a recipe of the root reads its verbs and its inputs by name', () => {
  it('a name of habit answers as its verb on the subject, a reader\'s verb under a noun of the root staying in the reader\'s queries', async () => {
    expect(await evalQuery(':number/tag ~(99) | 5 | get [~(desc) ~(tag ::desc !| tag)] | eq [::desc#5 ::number/tag/ArgsBeyondInputsError]')).toBe(true);
  });

  it('a name of habit answers as its verb on a value of a kind the reader declared, a verb of the reader under it among them', async () => {
    const post = ':Post |~~ A post. ~~| | :Post/tag ~(get /tag) | ::Post{:tag "a"}';
    expect(await evalQuery(`${post} | get [~(desc !| tag) ~(tag ::desc !| tag)] | eq [::Post/tag/ArgsBeyondInputsError ::Post/tag/ArgsBeyondInputsError]`)).toBe(true);
    const box = ':Box |~~ A box. ~~| | :Box/toSet ~(#[9]) | ::Box[2 1 2]';
    expect(await evalQuery(`${box} | get [~(distinct) ~(toSet)] | eq [#[9] #[9]]`)).toBe(true);
  });

  it('a name of habit answers as its verb under a verb a later source declares', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'later', source: ':number/tag (::fn | impl ~(99))' }] });
    expect((await notebook.evalCell('5 | get [~(desc !| tag) ~(tag ::desc !| tag)] | eq [::number/tag/ArgsBeyondInputsError ::number/tag/ArgsBeyondInputsError]')).result).toBe(true);
  });

  it('the inputs of `subOf` and `divOf` shadow a value of the reader of their names, and a verb under a noun of the root stays in the reader\'s queries', async () => {
    const reader = ':map/subtrahend ~(1) | :map/dividend ~(1) | {:a 6 :b 2}';
    expect(await evalQuery(`${reader} | apply ~(:minuend 1 | :divisor 1 | get [~(subOf /a /b) ~(divOf /a /b)]) | eq [4 3]`)).toBe(true);
  });
});

describe('what a verb reads and runs as data reads the tree of the query', () => {
  const pages = { uri: 'pages', source: ':pages |~~ Pages. ~~|\n:k |~~ the source\'s own ~~|\n:any/pageOf ~(doc | content)' };

  it('the names a verb of the root declares stay out of what it reads as data', async () => {
    expect(await evalQuery('get [~(::subject | tutorial !| tag) ~(:subject |~~ mine ~~| 1 | ::subject | tutorial | first | content)] | eq [::any/doc/UnknownNameError "mine"]')).toBe(true);
  });

  it('a verb of a source reads as data a label of the reader, and the tag of a label of the root stays the root\'s under a label of the reader of its name', async () => {
    const notebook = await createNotebook({ sources: [pages] });
    expect((await notebook.evalCell('::k | pageOf')).result).toBe('the source\'s own');
    expect((await notebook.evalCell(':k |~~ the reader\'s ~~| | ::k | pageOf')).result).toBe('the source\'s own');
    expect((await notebook.evalCell(':Mine |~~ the reader\'s ~~| | ::Mine | pageOf')).result).toBe('the reader\'s');
  });

  it('a verb of a source reads as data a node a later source declares', async () => {
    const reading = { uri: 'reading', source: ':reading |~~ Reading. ~~|\n:any/pageOf ~(doc | content)' };
    const later = { uri: 'later', source: ':later |~~ Later. ~~|\n:later/k |~~ the later source\'s ~~| 3' };
    const notebook = await createNotebook({ sources: [reading, later] });
    expect((await notebook.evalCell('::later/k | pageOf')).result).toBe('the later source\'s');
  });

  it('a verb the reader declares reads no declaration of its own recipe as data, and runs held code in a lane of its own', async () => {
    expect(await evalQuery(':any/f ~(:loc |~~ L ~~| 1 | ::loc | doc | content) | f !| tag')).toEqual(makeTag('any/doc/UnknownNameError'));
    expect(await evalQuery(':any/run (::fn | takes :code |~~ The code. ~~| /0 | takes :x |~~ An x. ~~| /1 | impl ~(apply code)) | "x" | parse | apply ~(:x 1 | :q it | null | run q 99 !| tag)'))
      .toEqual(makeTag('call/ValueWithheldError'));
  });

  it('a verb reads as data a name the query declares after the verb', async () => {
    expect(await evalQuery(':any/pageOf ~(doc | content) | :k |~~ K. ~~| | ::k | pageOf')).toBe('K.');
  });
});

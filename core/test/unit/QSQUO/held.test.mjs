import { describe, it, expect } from 'vitest';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { makeKeyword, makeTag } from '../../../src/types.mjs';

it('runs a template of a set as code written in the step, its quotes reading the names of the step', async () => {
  expect(await evalQuery(':k 5 | [1] | get #[~(k)]')).toEqual(await evalQuery('#[5]'));
});

describe('what a verb reads and runs as data reads the tree of the query', () => {
  const runner = { uri: 'runner', source: ':runner |~~ A runner. ~~|\n:any/runIt (::fn | takes :code |~~ The code. ~~| /0 | takes :x |~~ An x. ~~| /1 | impl ~(apply code))' };

  it('code held as data reads no value of the reader, past the inputs of a verb of the root', async () => {
    const notebook = await createNotebook({ sources: [runner] });
    expect((await notebook.evalCell(':x 1 | "x" | parse | :q it | null | runIt q 99 !| get [~(tag) /name]')).result)
      .toEqual([makeTag('call/ValueWithheldError'), makeKeyword('x')]);
  });

  it('held code reads a verb a later source declares, and the reader\'s verb that shadows it', async () => {
    const later = { uri: 'later', source: ':any/triple ~(mul 3)' };
    const notebook = await createNotebook({ sources: [later] });
    expect((await notebook.evalCell(':f ~(triple) | 2 | apply f')).result).toBe(6);
    expect((await notebook.evalCell(':number/triple ~(mul 30) | :g ~(triple) | 2 | apply g')).result).toBe(60);
  });

  it('a value of the reader that shadows a value of the root is withheld from held code, which the root\'s does not answer for', async () => {
    const host = { uri: 'host', source: ':pi 3' };
    const notebook = await createNotebook({ sources: [host] });
    expect((await notebook.evalCell(':f ~(pi) | apply f')).result).toBe(3);
    expect((await notebook.evalCell(':pi 4 | :f ~(pi) | apply f !| tag')).result).toEqual(makeTag('call/ValueWithheldError'));
  });
});

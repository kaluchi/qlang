import { describe, it, expect } from 'vitest';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { makeKeyword, makeTag } from '../../../src/types.mjs';

it('runs a template of a set as code written in the step, its quotes reading the names of the step', async () => {
  expect(await evalQuery('[1] | apply ~(:k 5 | get #[~(k)])')).toEqual(await evalQuery('#[5]'));
});

describe('what a verb reads and runs as data reads the tree of the query', () => {
  const runner = { uri: 'runner', source: ':runner |~~ A runner. ~~|\n:any/runIt (::fn | takes :code |~~ The code. ~~| /0 | takes :x |~~ An x. ~~| /1 | impl ~(apply code))' };

  it('code held as data reads no value of the reader, past the inputs of a verb of the root', async () => {
    const notebook = await createNotebook({ sources: [runner] });
    expect((await notebook.evalCell('"x" | parse | apply ~(:x 1 | :q it | null | runIt q 99 !| get [~(tag) ~(name)])')).result)
      .toEqual([makeTag('call/ValueWithheldError'), makeKeyword('x')]);
  });

  it('held code reads a verb a later source declares, and the reader\'s verb that shadows it', async () => {
    const later = { uri: 'later', source: ':any/triple ~(mul 3)' };
    const notebook = await createNotebook({ sources: [later] });
    expect((await notebook.evalCell('2 | apply ~(:f ~(triple) | apply f)')).result).toBe(6);
    expect((await notebook.evalCell(':number/triple ~(mul 30) | 2 | apply ~(:g ~(triple) | apply g)')).result).toBe(60);
  });

  it('a value of the reader named after a verb of the root is withheld from held code, which the root\'s verb does not answer for', async () => {
    const host = { uri: 'host', source: ':any/pi ~(3)' };
    const notebook = await createNotebook({ sources: [host] });
    expect((await notebook.evalCell('apply ~(:f ~(pi) | apply f)')).result).toBe(3);
    expect((await notebook.evalCell('apply ~(:pi 4 | :f ~(pi) | apply f !| tag)')).result).toEqual(makeTag('call/ValueWithheldError'));
  });
});

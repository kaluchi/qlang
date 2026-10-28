import { describe, it, expect } from 'vitest';
import { createNotebook, evalQuery } from '../../../src/notebook.mjs';
import { makeKeyword, makeTag } from '../../../src/types.mjs';

describe('the names `with` gives the parts of a value', () => {
  it('leave nothing in the scope of the cell after it', async () => {
    const notebook = await createNotebook();
    expect((await notebook.evalCell('{:id 7 :user {:name "Ann"}} | with [/id /user/name] ~(name | append (id | toString))')).result).toBe('Ann7');
    expect((await notebook.evalCell('::host | env | keys | count')).result).toBe(0);
  });

  it('reach a body held as data, which reads no value of the reader', async () => {
    expect(await evalQuery('{:id 7} | apply ~(:b ~(id | add 1); with [/id] b)')).toBe(8);
    expect(await evalQuery('{:id 7} | apply ~(:r 10; :b ~(id | add r); with [/id] b !| get [~(tag) ~(name)])'))
      .toEqual([makeTag('call/ValueWithheldError'), makeKeyword('r')]);
  });
});

describe('a name of `with` and a verb of the same name', () => {
  it('the name stands over a verb the reader declares, which its address calls, and a later step refuses the name', async () => {
    expect(await evalQuery(':vec/second ~(get /1); [7 8] | with {:second ~first} ~(get [~(second) ~(vec/second) ~(reverse | second !| tag)])'))
      .toEqual([7, 8, makeTag('call/ValueAsALaterStepError')]);
  });

  it('the name stands over a verb a later source declares, which its address calls, and a later step refuses the name', async () => {
    const notebook = await createNotebook({ sources: [{ uri: 'later', source: ':number/triple ~(mul 3);' }] });
    expect((await notebook.evalCell('[7 8] | with {:triple ~first} ~(get [~(triple) ~(1 | number/triple) ~(1 | triple !| tag)])')).result)
      .toEqual([7, 3, makeTag('call/ValueAsALaterStepError')]);
  });
});

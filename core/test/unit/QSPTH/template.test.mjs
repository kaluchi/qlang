import { describe, it, expect } from 'vitest';
import { createSession, evalQuery } from '../../../src/session.mjs';
import { keyword, makeTag } from '../../../src/types.mjs';

describe('the names `with` gives the parts of a value', () => {
  it('leave nothing in the scope of the cell after it', async () => {
    const session = await createSession();
    expect((await session.evalCell('{:id 7 :user {:name "Ann"}} | with [/id /user/name] ~(name | append (id | toString))')).result).toBe('Ann7');
    expect((await session.evalCell('env | keys | count')).result).toBe(0);
  });

  it('reach a body held as data, which reads no value of the reader', async () => {
    expect(await evalQuery(':b ~(id | add 1) | {:id 7} | with [/id] b')).toBe(8);
    expect(await evalQuery(':r 10 | :b ~(id | add r) | {:id 7} | with [/id] b !| get [~(type) /name]'))
      .toEqual([makeTag('call/ValueWithheldError'), keyword('r')]);
  });
});

describe('a name of `with` and a verb of the same name', () => {
  it('meet where a verb the reader declares serves the subject, and the name is read where none does', async () => {
    expect(await evalQuery(':vec/second ~(get /1) | [7 8] | get [~(with {:second ~first} ~(second) !| type) ~(with {:second ~first} ~(5 | second))]'))
      .toEqual([makeTag('call/ValueMeetsVerbError'), 7]);
  });

  it('meet where a verb a later source declares serves the subject, and the name is read where none does', async () => {
    const session = await createSession({ sources: [{ uri: 'later', source: ':number/triple ~(mul 3)' }] });
    expect((await session.evalCell('[7 8] | get [~(with {:triple ~first} ~(1 | triple) !| type) ~(with {:triple ~first} ~(triple))]')).result)
      .toEqual([makeTag('call/ValueMeetsVerbError'), 7]);
  });
});

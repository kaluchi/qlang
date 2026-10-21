import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { parse } from '../../../src/parse.mjs';

describe('the root of the language', () => {
  it('every kind of the root is built by the chain of a kind', async () => {
    expect(await evalQuery('kinds | map ~(binding | get /value | type) | distinct')).toEqual(await evalQuery('#[::kind]'));
  });
});

describe('the chain of a kind as the body of a bare name', () => {
  it('declares a word of a literal by the chain of a kind, and refuses it any other body', () => {
    expect(() => parse(':null\n  |~~ Nothing. ~~|\n  ::kind\n    | wraps |~~ Null. ~~|')).not.toThrow();
    expect(() => parse(':null\n  |~~ Nothing. ~~|\n  ::kind[~() null]')).not.toThrow();
    expect(() => parse(':null |~~ Nothing. ~~| 5')).toThrow(/word of a literal/);
  });
});

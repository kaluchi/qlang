import { it, expect } from 'vitest';
import { evalQuery } from '../../../src/notebook.mjs';
import { parseSource } from '../../../src/parse.mjs';

it('every kind of the root is built by the chain of a kind', async () => {
  expect(await evalQuery('::host | kinds | map ~(binding | value | tag) | distinct')).toEqual(await evalQuery('#[::kind]'));
});

it('declares a word of a literal by the chain of a kind, and refuses it any other body', () => {
  expect(() => parseSource(':null\n  |~~ Nothing. ~~|\n  ::kind\n    | accepts |~~ Null. ~~|;')).not.toThrow();
  expect(() => parseSource(':null\n  |~~ Nothing. ~~|\n  ::kind[~() null];')).not.toThrow();
  expect(() => parseSource(':null |~~ Nothing. ~~| 5')).toThrow(/word of a literal/);
});

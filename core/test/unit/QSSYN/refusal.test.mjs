import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../../src/parse.mjs';
import { refusalOf } from '../../helpers/read-text.mjs';

describe('what a refusal of the parser says', () => {
  // A refusal lists its continuations as literals and as parts of the
  // grammar named in the words of the language, no class of characters
  // among them.
  it('lists no class of characters among the continuations of a refusal', () => {
    for (const source of ['"\\u12"', '#"a', '#"a")', '(|~~| a', '(|~~| ``a', '[|~~ a', '|~~ ~("[.']) {
      let refusal = null;
      try { parse(source); } catch (e) { refusal = e; }
      expect(refusal, source).toBeInstanceOf(ParseError);
      expect(refusal.expected.filter(alternative => alternative.type === 'class'), source).toEqual([]);
    }
  });

  it('names the prose of a doc beside the literals it may meet, so a source cut short in its quote names the bracket it left open', () => {
    expect(refusalOf('|~~ mentions |').expected.map(alternative => alternative.text ?? alternative.description))
      .toEqual(expect.arrayContaining(['character of prose', '::', '~(', '`', '|~~|', '|~|', '|~~', '|~', '~|', '~~|']));
    expect(refusalOf('~(|~~ see ::vec~(').message).toBe('`~(` opened at line 1, column 16 is never closed; `)~~|)` completes the source');
  });

  it('says what could stand where the reading stopped as `:expected` names it, and what stood there', () => {
    expect(refusalOf('"a" | :').message).toBe('Expected "\\"" or name but end-of-source found.');
    expect(refusalOf('"\\u12"').message).toBe('Expected hexadecimal digit but "\\"" found.');
    expect(refusalOf('#"a")').message).toBe('Expected end-of-source, flag of a regex or whitespace but ")" found.');
  });

  it('names in the refusal the source its caller named', () => {
    try {
      parse('[1 2', { uri: 'cell-7' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.uri).toBe('cell-7');
    }
  });
});

it('refuses a bare nest left open of groups, quotes and maps reading each depth once', () => {
  for (const nest of ['('.repeat(64) + 'x ]', '~('.repeat(64) + 'x', '{:a '.repeat(64) + '1']) expect(refusalOf(nest), nest.slice(0, 8)).toBeInstanceOf(ParseError);
});

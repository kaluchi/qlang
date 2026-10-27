import { describe, it, expect } from 'vitest';
import { parseSource, SourceParseError } from '../../../src/parse.mjs';
import { stepOf, refusalOf } from '../../helpers/read-text.mjs';

describe('a doc documents the declaration whose slot it stands in', () => {
  it('holds the docs of the slot as the record of the declaration holds any doc', () => {
    const [declaration] = parseSource(':x |~~ one ~~| |~~ two ~~| 42');
    expect(declaration.get('docs').map(doc => [...doc])).toEqual([['one'], ['two']]);
  });

  it('refuses a doc written before a declaration, on its line or the one above', () => {
    expect(() => parseSource('|~~ note ~~| :x 42')).toThrow(/slot of the declaration/);
    expect(() => parseSource('5 | |~~ note ~~| :x 42')).toThrow(/slot of the declaration/);
    expect(() => parseSource('|~~| note\n:x 42')).toThrow(/slot of the declaration/);
    expect(() => parseSource(':y 1\n|~~ note ~~|\n:x 42')).toThrow(/slot of the declaration/);
  });
});

describe('a quote of a doc is code', () => {
  it('refuses a quote of a doc whose text reads as no code with the refusal it meets as code, in a block doc and in a line doc', () => {
    for (const text of [
      '| | f', '|f', '::Box f', '::Box |~~ d ~~|', 'f |~ c', 'f | ', 'f | !| | g', 'f | | g', 'f| g', 'f |g', 'f(a)(b)', 'f a, b', '5 f', '5\nf',
      '5 |~~ d ~~|', '/ne ""', '::T(1)', '::T([1])', '::T(add 1)', '(f a, b)', '~(/a)', '~(f a, b)', '~/a', '~[1]',
      '{:a 1 "b": 2}', '{"a": 1, :b 2}', '{:k f x}', '#"("', '#{1}', '[1[2]]', 'get /a?', 'get /', 'f 01', 'f [x]', ':x [y]', ':true 1', '5 | 6', '[x]',
      'f !| /a', 'f\n:x [y]', '::Box[x]', '!{:k x}', '::E!{:k x}', '.a', 'get .a', '.', 'f; g',
      '/ne :x 1', '::Box :x 1', '|~~ note ~~| :x 1', ':true :x 1'
    ]) {
      expect(refusalOf(text), text).toBeInstanceOf(SourceParseError);
      expect(refusalOf(`|~~ a ~(${text}) b ~~|`), text).toBeInstanceOf(SourceParseError);
      expect(refusalOf(`|~~| a ~(${text}) b`), text).toBeInstanceOf(SourceParseError);
    }
  });

  it('refuses a quote of a doc at the part that breaks a rule, with the message of the rule', () => {
    expect(refusalOf('|~~ see ~(/a) ~~|').message).toContain('give the path bare, `/a`');
    for (const [source, written] of [['|~~ a ~(f 01) ~~|', '1'], ['|~~| a ~(-01.5e3) b', '-1.5e3'], ['|~~ ::link~(00) ~~|', '0']]) {
      expect(refusalOf(source).message, source).toBe(`a number is written without a leading zero: write \`${written}\``);
    }
    const refused = refusalOf('[|~~| x ~(a\n 1 2 , 3]');
    expect([refused.location.start.offset, refused.message]).toEqual([17, 'modifiers are separated by spaces, not by commas: `f a b`']);
  });

  it('names the quote of a doc left open at the end of the source', () => {
    expect(refusalOf('|~~| x ~(a').message).toBe('`~(` opened at line 1, column 8 is never closed; `)` completes the source');
  });

  it('reads a quote of a line doc across the lines it runs on, the prose after it to the end of the line it closes on', () => {
    expect(stepOf('|~~| see ~(5\n  | add 1) and more').map(segment => (typeof segment === 'string' ? segment : 'quote'))).toEqual(['see ', 'quote', ' and more']);
  });

  it('reads a quote between backquotes as prose whole', () => {
    expect([...stepOf('|~~ write `~(1 | )` whole ~~|')]).toEqual(['write `~(1 | )` whole']);
    expect([...stepOf('|~~| write `~(add 1` whole')]).toEqual(['write `~(add 1` whole']);
  });
});

it('reads as code a quote of a doc that takes a value after a declaration or after `!|`', () => {
  for (const quote of ['~(:x 1 | 5)', '~(f !| 0)']) expect(stepOf(`|~~ a ${quote} b ~~|`), quote).toHaveLength(3);
});

describe('a block doc left unbalanced, refused', () => {
  const neverClosedDoc = '`|~~` opened at line 1, column 1 is never closed; `~~|` completes the source';
  const expectRefusedAt = (src, offset, found) => {
    const refused = refusalOf(src);
    expect(refused, src).toBeInstanceOf(SourceParseError);
    expect([refused.location.start.offset, refused.found], src).toEqual([offset, found]);
  };

  it('a block doc with no closing ~~| names where it opened', () => {
    expect(refusalOf('|~~ unterminated doc\n:foo 1\n| foo').message).toBe(neverClosedDoc);
  });

  it('a block doc whose inner nested doc swallows the outer close names where it opened', () => {
    expect(refusalOf('|~~ A |~~ B ~~|\n:foo 1\n| foo').message).toBe(neverClosedDoc);
  });

  it('refuses a closer `~~|` that stands where a step does, with no opener', () => {
    expectRefusedAt('42 | ~~|', 6, '~');
  });
});

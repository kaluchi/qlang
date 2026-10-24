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

describe('a quote of a doc tried as code', () => {
  it('reads a quote of a path alone in a doc as prose', () => {
    expect([...stepOf('|~~ see ~(/a) ~~|')]).toEqual(['see ~(/a)']);
  });

  it('reads a number written with a leading zero in the quote of a doc as prose', () => {
    for (const source of ['|~~ a ~(f 01) ~~|', '|~~ a ~(f [x] 01) ~~|', '|~~| a ~(-01.5e3) b', '|~~ ::link~(00) ~~|']) expect(stepOf(source), source).toHaveLength(1);
  });

  it('reads a `~(` of a line doc that reads as no code to the `)` that pairs it on its line, as prose', () => {
    expect([...stepOf('|~~|~(0 | ~())')]).toEqual(['~(0 | ~())']);
    expect(refusalOf('[|~~| ~(a,\n 1) 2\n]')).toBeInstanceOf(SourceParseError);
  });

  it('reads a `~(` of a block doc that reads as no code to the `)` that pairs it across its lines after a line doc whose `~(` pairs none on its line', () => {
    expect(stepOf('[|~~| a ~(b\n |~~ ~(a,\n ~(add 1)) ~~|]').map(doc => [...doc])).toEqual([['a ~(b'], ['~(a,\n~(add 1))']]);
  });

  it('reads the span of a `~(` of a line doc no further than its line, through a doc or a comment nested in it', () => {
    for (const nested of ['|~~ b\n 1 2 ~~|', '|~ b\n 1 2 ~|']) expect(refusalOf(`[|~~| a ~(f ${nested}) c\n]`)?.location.start.line, nested).toBe(2);
  });

  it('reads a `~(` of a line doc after a span of its line read as prose as it reads it with no span before it', () => {
    for (const quote of ['~(f |~~ ~(( ~~|) d', '~(f |~ ~(( ~|) d']) {
      expect([...stepOf(`(|~~| ~(a,) ${quote}\n)`).payload[0]], quote).toEqual([`~(a,) ${quote}`]);
      expect([...stepOf(`(|~~| ${quote}\n)`).payload[0]], quote).toEqual([quote]);
    }
  });

  it('refuses a text after a line doc whose `~(` reads as no code where its reading stopped, the span naming no continuation of its own', () => {
    const refused = refusalOf('[|~~| x ~(a\n 1 2 , 3]');
    expect([refused.location.start.offset, refused.found]).toEqual([17, ',']);
    expect([...new Set(refusalOf('[|~~| x ~(a').expected.map(alternative => alternative.text ?? alternative.description))])
      .toEqual(['letters of a name', '/', 'whitespace', ')', 'character of prose', '::', '~(', '`', ',', ']']);
  });

  it('fails the try of the quote of a doc on a rule of a step and on a refusal the grammar does not pass over there, a refusal it passes over letting the quote read as code', () => {
    for (const text of [
      '| | f', '|f', '::Box f', '::Box |~~ d ~~|', 'f |~ c', 'f | ', 'f | !| | g', 'f | | g', 'f| g', 'f |g', 'f(a)(b)', 'f a, b', '5 f', '5\nf',
      '5 |~~ d ~~|', '/ne ""', '::T(1)', '::T([1])', '::T(add 1)', '(f a, b)', '~(/a)', '~(f a, b)', '~/a', '~[1]',
      '{:a 1 "b": 2}', '{"a": 1, :b 2}', '{:k f x}', '#"("', '#{1}', '[1[2]]', 'get /a?', 'get /', 'f 01', 'f [x]', ':x [y]', ':true 1', '5 | 6', '[x]',
      'f !| /a', 'f\n:x [y]', '::Box[x]', '!{:k x}', '::E!{:k x}', '.a', 'get .a', '.', 'f; g'
    ]) {
      expect(refusalOf(text), text).toBeInstanceOf(SourceParseError);
      expect([...stepOf(`|~~ a ~(${text}) b ~~|`)], text).toEqual([`a ~(${text}) b`]);
      if (!text.includes('\n')) expect([...stepOf(`|~~| a ~(${text}) b`)], text).toEqual([`a ~(${text}) b`]);
    }
    for (const text of ['/ne :x 1', '::Box :x 1', '|~~ note ~~| :x 1', ':true :x 1']) {
      expect(refusalOf(text), text).toBeInstanceOf(SourceParseError);
      expect(stepOf(`|~~ a ~(${text}) b ~~|`), text).toHaveLength(3);
    }
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

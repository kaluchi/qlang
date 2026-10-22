import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../../src/parse.mjs';
import { isBindStep } from '../../../src/steps.mjs';
import { stepOf, refusalOf, rootOf } from '../../helpers/read-text.mjs';

describe('a comment read as whitespace', () => {
  it('keeps a line comment on the side', () => {
    const source = `|~| this is a comment
      | [1 2 3] | count`;
    expect(rootOf(source).comments.map(comment => [comment.type, comment.content]))
      .toEqual([['LinePlainComment', ' this is a comment']]);
  });

  it('reads a comment where a word would touch another as no pipe', () => {
    expect(() => parse('[1] |~ note ~| count')).toThrow('steps are joined by `|`: write `a | b`');
  });

  it('reads a declaration after a comment on its line with its doc in its slot and its body on the next line', () => {
    const declaration = stepOf('|~ note ~| :x |~~| about x\n1');
    expect(isBindStep(declaration)).toBe(true);
    expect([declaration.get('docs').map(doc => [...doc]), declaration.get('body')]).toEqual([[['about x']], 1]);
  });

  it('keeps the comment of a source of comments alone on the side', () => {
    expect(rootOf('|~ only a note ~|').comments).toHaveLength(1);
  });
});

describe('a block comment that nests', () => {
  const blockStep = (src) => rootOf(src).comments[0];

  describe('the content it holds as written', () => {
    it('a block comment holds adjacent nested pairs', () => {
      const step = blockStep('|~ |~ a ~| middle |~ b ~| ~|\n| 1');
      expect(step.content).toBe(' |~ a ~| middle |~ b ~| ');
    });

    it('a block comment holds a nested doc pair as its content', () => {
      const step = blockStep('|~ wraps |~~ inner doc ~~| inside ~|\n| 1');
      expect(step.content).toBe(' wraps |~~ inner doc ~~| inside ');
    });

    it('a block comment holds a bare ~~| as its content', () => {
      const step = blockStep('|~ doc-close marker ~~| mentioned ~|\n| 1');
      expect(step.content).toBe(' doc-close marker ~~| mentioned ');
    });

    it('a |~| inside a block comment hides no closer on its line', () => {
      const step = blockStep('|~ holds a |~| line mention here ~|\n| 7');
      expect(step.content).toBe(' holds a |~| line mention here ');
    });

    it('a |~~| inside a block comment hides no closer on its line', () => {
      const step = blockStep('|~ holds a |~~| line-doc mention here ~|\n| 7');
      expect(step.content).toBe(' holds a |~~| line-doc mention here ');
    });

    it('a block comment keeps a quote span that holds a bare ~|', () => {
      const step = blockStep('|~ keeps ~( literal ~| close ) afterward ~|\n| 1');
      expect(step.content).toBe(' keeps ~( literal ~| close ) afterward ');
    });

    it('a block comment holds an empty nested pair', () => {
      const step = blockStep('|~ before |~ ~| after ~|\n| 1');
      expect(step.content).toBe(' before |~ ~| after ');
    });
  });

  it('reads a block comment that holds a doc marker and code whole', () => {
    const src = [
      '|~ The refusals the guards of this source raise. Each is a tag',
      '   a doc names, `:FooError |~~ ~~|`, so the axes read it,',
      '   `::AssertionFailedError | doc`, `| source` and `| doc | laws`,',
      '   and `result !| type` reads the tag of a failure back. ~|',
      '| 42'
    ].join('\n');
    const step = blockStep(src);
    expect(step.type).toBe('BlockPlainComment');
    expect(step.content).toContain('|~~ ~~|');
    expect(step.content).toContain('::AssertionFailedError | doc');
  });

  describe('a nest left unbalanced, refused', () => {
    const expectRefusedAt = (src, offset, found) => {
      const refused = refusalOf(src);
      expect(refused, src).toBeInstanceOf(ParseError);
      expect([refused.location.start.offset, refused.found], src).toEqual([offset, found]);
    };

    const expectLeftOpen = (src, message) => {
      const refused = refusalOf(src);
      expect(refused, src).toBeInstanceOf(ParseError);
      expect([refused.message, refused.location.start.offset, refused.found], src).toEqual([message, src.length, null]);
    };

    it('a block comment with no closing ~| at all is refused naming its opener', () => {
      expectLeftOpen('|~ unterminated block\n| 1', '`|~` opened at line 1, column 1 is never closed; `~|` completes the source');
    });

    it('a block comment whose inner nested comment swallows the outer close is refused naming the outer opener', () => {
      expectLeftOpen('|~ A |~ B ~|\n| 1', '`|~` opened at line 1, column 1 is never closed; `~|` completes the source');
    });

    it('refuses a closer `~|` that stands where a step does, with no opener', () => {
      expectRefusedAt('42 | ~|', 6, '|');
    });

    it('a block comment that holds a bare ~~| and no ~| of its own is refused naming its opener', () => {
      expectLeftOpen('|~ stuff ~~|\n| 1', '`|~` opened at line 1, column 1 is never closed; `~|` completes the source');
    });
  });

  describe('its content the text between its markers', () => {
    const cases = [
      '|~ a ~|',
      '|~ outer |~ inner ~| tail ~|',
      '|~ A |~ B |~ C ~| D ~| E ~|',
      '|~ wraps ~( inner |~ q ~| ) closing ~|',
      '|~ multi\n  line\n  with |~ nested ~| inside ~|'
    ];

    it.each(cases)('reproduces .content from source slice — %s', (src) => {
      expect(blockStep(src + '\n| count').content).toBe(src.slice('|~'.length, src.length - '~|'.length));
    });
  });
});

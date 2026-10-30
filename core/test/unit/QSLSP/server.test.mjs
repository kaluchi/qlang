import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';
import { forEachPart, partAtOffset } from '../../../src/parsed-parts.mjs';
import { isCallStep } from '../../../src/steps.mjs';
import { isVec, isQuote } from '../../../src/types.mjs';
import { rootOf } from '../../helpers/read-text.mjs';

it('hands the tools the parts of a text and the letters of a name', () => {
  const root = core.partOf(core.parseSource(':x 1; x'));
  expect(core.findNameOccurrences(root, 'x')).toHaveLength(2);
  expect([core.isNameStart('a'), core.isNameStart('_'), core.isNameStart('@')]).toEqual([true, true, false]);
});

describe('the parts of a text', () => {
  it('holds the span of the text of a doc, its quotes among it, which ends where its last word does, the whitespace before its closer aside', () => {
    const source = ':x\n  |~~ one\n  two ~(add 1)\n  three\n  ~~|\n  1; |~~| a line  ';
    const [bind, line] = rootOf(source).parts;
    const [, doc] = bind.parts;
    const textOf = ({ text }) => [source.slice(text.start.offset, text.end.offset), text.end.line];
    expect(textOf(doc)).toEqual([' one\n  two ~(add 1)\n  three', 4]);
    expect(textOf(line)).toEqual([' a line', 6]);
  });

  it('holds the code between the backquotes of a doc, a run of them closing at a run of as many, across the lines of a block doc', () => {
    const codeOf = source => rootOf(source).parts[0].backquoted.map(({ start, end }) => source.slice(start.offset, end.offset));
    expect(codeOf('|~~ a `count` b ``x`y`` c `` d ~~|')).toEqual(['count', 'x`y']);
    expect(codeOf('|~~ a `[1\n2]` ~(x) ~~|')).toEqual(['[1\n2]']);
    expect(codeOf('|~~| a `add 1`')).toEqual(['add 1']);
  });
});

describe('the parts the parser keeps', () => {
  it('visits every part before the parts it holds', () => {
    const visited = [];
    forEachPart(rootOf('[1 2] | add 3'), ({ value }) => visited.push(isQuote(value) ? 'quote' : isVec(value) ? 'vec' : isCallStep(value) ? 'call' : value));
    expect(visited).toEqual(['quote', 'vec', 1, 2, 'call', 3]);
  });

  it('skips the parts of a part its visitor answers false for', () => {
    const numbers = [];
    forEachPart(rootOf('[1 2] | add 3'), ({ value }) => {
      if (typeof value === 'number') numbers.push(value);
      if (isVec(value) && !isQuote(value)) return false;
    });
    expect(numbers).toEqual([3]);
  });

  it('passes the parent to the visitor', () => {
    const parents = [];
    forEachPart(rootOf('[1 2 3]'), ({ value }, parent) => {
      if (typeof value === 'number') parents.push(parent.value);
    });
    expect(parents).toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  });
});

describe('the part at a position', () => {
  it('returns null when the offset is outside any part', () => {
    expect(partAtOffset(rootOf('[1 2 3]'), 999)).toBeNull();
  });

  it('returns the narrowest part holding the offset', () => {
    const read = partAtOffset(rootOf('[1 2 3] | filter (gt 2)'), 19);
    expect(read.value.get('name').name).toBe('gt');
  });

  it('returns the part at the start of a number literal', () => {
    expect(partAtOffset(rootOf('42'), 0).value).toBe(42);
  });
});

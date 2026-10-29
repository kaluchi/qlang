import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';
import { parseSource, SourceParseError } from '../../../src/parse.mjs';
import { stepOf } from '../../helpers/read-text.mjs';

describe('the regex of a name', () => {
  it('hands an editor the regex of a name, which reads the letters of a name as the parser reads them', () => {
    const whole = new RegExp(`^(?:${core.NAME_REGEX.source})$`, 'u');
    const letters = Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).filter(letter => !/[\ud800-\udfff]/.test(letter));
    expect(letters.filter(letter => whole.test(letter) !== core.isNameStart(letter) || whole.test(`a${letter}`) !== core.isNameContinue(letter))).toEqual([]);
    expect([...':имя 5; vec/count | _x-1'.matchAll(new RegExp(core.NAME_REGEX.source, 'gu'))].map(([name]) => name)).toEqual(['имя', 'vec', 'count', '_x-1']);
  });

  it('reads a letter past the first plane of Unicode in the regex of a name, as the parser reads a character a code point', async () => {
    expect([...'a𝐀b c𝐁'.matchAll(new RegExp(core.NAME_REGEX.source, 'gu'))].map(([name]) => name)).toEqual(['a𝐀b', 'c𝐁']);
    expect(await core.evalQuery(':a𝐀 1; a𝐀')).toBe(1);
  });
});

describe('the letters that begin a name', () => {
  it('refuses a digit at the start of a bare keyword', () => {
    for (const source of [':0', ':1name']) expect(() => parseSource(source), source).toThrow(SourceParseError);
  });

  it('rejects a bracket or a punctuation mark as the start of a name (not in ID_Start)', () => {
    expect(() => parseSource(':<tag')).toThrow(SourceParseError);
    expect(() => parseSource(':{key')).toThrow(SourceParseError);
    expect(() => parseSource(':!mark')).toThrow(SourceParseError);
  });

  it('reads a letter past the first plane of Unicode as the start of a bare name, the one keyword its quoted form writes', () => {
    expect(stepOf(':\u{10400}').name).toBe('\u{10400}');
    expect(stepOf(':"\u{10400}"').name).toBe('\u{10400}');
  });
});

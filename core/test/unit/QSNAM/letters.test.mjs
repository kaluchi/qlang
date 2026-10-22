import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';
import { parse, ParseError } from '../../../src/parse.mjs';
import { stepOf } from '../../helpers/read-text.mjs';

describe('the regex of a name', () => {
  it('hands an editor the regex of a name, which reads the letters of a name as the parser reads them', () => {
    const whole = new RegExp(`^(?:${core.NAME_REGEX.source})$`, 'u');
    const letters = Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).filter(letter => !/[\ud800-\udfff]/.test(letter));
    expect(letters.filter(letter => whole.test(letter) !== core.isNameStart(letter) || whole.test(`a${letter}`) !== core.isNameContinue(letter))).toEqual([]);
    expect([...':имя 5 | vec/count | _x-1'.matchAll(new RegExp(core.NAME_REGEX.source, 'gu'))].map(([name]) => name)).toEqual(['имя', 'vec', 'count', '_x-1']);
  });

  it('reads no letter past the first plane of Unicode in the regex of a name, as the parser reads a character a code unit', async () => {
    expect([...'a𝐀b c𝐁'.matchAll(new RegExp(core.NAME_REGEX.source, 'gu'))].map(([name]) => name)).toEqual(['a', 'b', 'c']);
    expect(await core.evalQuery('":a𝐀 1" | parse !| type')).toEqual(core.makeTag('quote/ParseError'));
  });
});

describe('the letters that begin a name', () => {
  it('refuses a digit at the start of a bare keyword', () => {
    for (const source of [':0', ':1name']) expect(() => parse(source), source).toThrow(ParseError);
  });

  it('rejects a bracket or a punctuation mark as the start of a name (not in ID_Start)', () => {
    expect(() => parse(':<tag')).toThrow(ParseError);
    expect(() => parse(':{key')).toThrow(ParseError);
    expect(() => parse(':!mark')).toThrow(ParseError);
  });

  it('reads no letter past the first plane of Unicode as the start of a bare name, and its quoted form takes it', () => {
    // The parser reads a character a UTF-16 code unit, so U+10400, a letter of
    // ID_Start past the first plane, is two units and starts no bare name.
    expect(() => parse(':\u{10400}')).toThrow(ParseError);
    expect(stepOf(':"\u{10400}"').name).toBe('\u{10400}');
  });
});

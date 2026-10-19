// The surface of the package root: what a host, the command line, the
// language server and the site build on, each function behind one door.
// The rules it holds: [QSWRK#tooling].

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as core from '../../src/index.mjs';
import { tokenize } from '../../src/highlight.mjs';

describe('the package root', () => {
  it('parses a source and evaluates a query', async () => {
    expect([...core.parse('42')]).toEqual([42]);
    expect(await core.evalQuery('[1 2 3] | count')).toBe(3);
  });

  it('keeps a session whose cells share their names', async () => {
    const session = await core.createSession();
    await session.evalCell(':x 2');
    expect((await session.evalCell('x | add 1')).result).toBe(3);
  });

  it('prints a value as the literal that reads back as it', async () => {
    const value = await core.evalQuery('{:a #[1 2] :t ::Box[3]}');
    expect(await core.evalQuery(core.printValue(value))).toEqual(value);
  });

  it('bounds an answer within a budget, a part a kind prints its own way counted as it prints', async () => {
    const session = await core.createSession();
    const cell = await session.evalCell(':Box |~~ B ~~| | :Box/print ~("b") | [::Box#1 ::Box#2 ::Box#3 ::Box#4 ::Box#5 ::Box#6 ::Box#7]');
    const shown = await core.elideAnswer(cell.result, 10, cell.scopeAfterCell);
    expect(await core.printAnswer(shown, cell.scopeAfterCell)).toBe('[b b b b b b b]');
  });

  it('crosses the JSON boundary both ways', () => {
    const lifted = core.fromPlain({ name: 'alice' });
    expect(core.toPlain(lifted)).toEqual({ name: 'alice' });
  });

  it('hands the tools the parts of a text and the letters of a name', () => {
    const root = core.partOf(core.parse(':x 1 | x'));
    expect(core.findNameOccurrences(root, 'x').length).toBeGreaterThan(0);
    expect([core.isNameStart('a'), core.isNameStart('_'), core.isNameStart('@')]).toEqual([true, true, false]);
  });

  it('hands an editor the regex of a name, which reads the letters of a name as the parser reads them [QSNAM#letters], [QSHST#tools]', () => {
    const whole = new RegExp(`^(?:${core.NAME_REGEX.source})$`, 'u');
    const letters = Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).filter(letter => !/[\ud800-\udfff]/.test(letter));
    expect(letters.filter(letter => whole.test(letter) !== core.isNameStart(letter) || whole.test(`a${letter}`) !== core.isNameContinue(letter))).toEqual([]);
    expect([...':имя 5 | vec/count | _x-1'.matchAll(new RegExp(core.NAME_REGEX.source, 'gu'))].map(([name]) => name)).toEqual(['имя', 'vec', 'count', '_x-1']);
  });

  it('reads no letter past the first plane of Unicode in the regex of a name, as the parser reads a character a code unit [QSNAM#letters], [QSHST#tools]', async () => {
    expect([...'a𝐀b c𝐁'.matchAll(new RegExp(core.NAME_REGEX.source, 'gu'))].map(([name]) => name)).toEqual(['a', 'b', 'c']);
    expect(await core.evalQuery('":a𝐀 1" | parse !| type')).toEqual(core.makeTag('quote/ParseError'));
  });

  it('exports no symbol of the runtime a consumer does not read', () => {
    for (const internal of ['evalPipeline', 'keepParts', 'repeatsDeclarationAt', 'QlangError', 'makeTagged', 'formOf', 'EVAL_DEPTH_LIMIT']) {
      expect(core[internal], internal).toBeUndefined();
    }
  });
});

describe('the doors of the package [QSWRK#tooling]', () => {
  it('opens its root, its errors, its painter and the sources of its catalog, and no other door', () => {
    const { exports } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(Object.keys(exports)).toEqual(['.', './errors', './highlight', './lib/qlang.qlang', './lib/qlang/*.qlang']);
  });

  it('hands the tokens a painter paints by its light door alone', () => {
    expect(core.tokenize).toBeUndefined();
    expect(tokenize('[1] | count', new Set(['count'])).length).toBeGreaterThan(0);
  });
});

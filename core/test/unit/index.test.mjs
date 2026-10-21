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

  it('answers an answer whose print fits the budget as it is, a part a kind prints its own way counted as it prints [D397]', async () => {
    const session = await core.createSession();
    const cell = await session.evalCell(`:Box |~~ B ~~| | :Box/print ~("b") | ${core.ANSWER_BUDGET} | range | map ~(tag ::Box) | take ${core.ANSWER_BUDGET / 2 - 1}`);
    const shown = await core.boundAnswer(cell.result, cell.scopeAfterCell);
    expect(shown).toBe(cell.result);
    expect((await core.printAnswer(shown, cell.scopeAfterCell)).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
  });

  it('answers an answer past the budget as the refusal in its place, its answer cut to an excerpt read from the answer [D397]', async () => {
    const scope = await core.langRuntime();
    const answer = await core.evalQuery('3000 | range | map ~(get {:id ~(it) :name "user"})', scope);
    const shown = await core.boundAnswer(answer, scope);
    expect(shown.tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
    expect([...shown.facts.keys()]).toEqual(['characters', 'budget', 'actualType', 'actualValue']);
    expect(shown.facts.get('characters')).toBe((await core.printAnswer(answer, scope)).length);
    expect([shown.facts.get('budget'), shown.facts.get('actualType')]).toEqual([core.ANSWER_BUDGET, core.makeTag('vec')]);
    expect(await core.printAnswer(shown.facts.get('actualValue'), scope)).toMatch(/^\[\{:id 0 :name "user"\} [\s\S]*::elision\{:size \d+ :read ~\(drop \d+\)\}\]$/);
  });

  it('measures the text a host writes for a string, as the host hands it [D397]', async () => {
    const scope = await core.langRuntime();
    const text = 'x'.repeat(core.ANSWER_BUDGET);
    expect(await core.boundAnswer(text, scope, text)).toBe(text);
    expect((await core.boundAnswer(`${text}x`, scope, `${text}x`)).tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
  });

  it('lets an answer past the budget give way whole as its head where no cut fits the excerpt, read beneath !| for a failure [D397]', async () => {
    const scope = await core.langRuntime();
    const query = '400 | range | map ~("k") | join "" | :long it | 3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | :m it | get [[~(long | toKeyword) 1]] | toMap | union m';
    const headOf = async written => (await core.boundAnswer(await core.evalQuery(written, scope), scope)).facts.get('actualValue');
    const [ofTheAnswer, ofTheFailure] = [await headOf(query), await headOf(`${query} | raise`)];
    expect([ofTheAnswer.get('size'), core.printValue(ofTheAnswer.get('read')), core.printValue(ofTheFailure.get('read'))]).toEqual([3001, '~()', '~(!| it)']);
  });

  it('answers a failure whose alert passes the budget as the refusal, its kind the tag of the failure and its head read beneath !| [D397]', async () => {
    const scope = await core.langRuntime();
    const failure = await core.evalQuery('3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise', scope);
    const shown = await core.boundAnswer(failure, scope);
    expect([shown.tag, shown.facts.get('actualType')]).toEqual([core.makeTag('qlang/AnswerBeyondBudgetError'), core.makeTag('error')]);
    expect(core.printValue(shown)).toContain(':read ~(!| ');
    expect(core.printValue(shown).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
  });

  it('counts the characters of a print as count counts a string [D397]', async () => {
    const scope = await core.langRuntime();
    const faces = count => '\u{1F600}'.repeat(count);
    expect(await core.boundAnswer(faces(core.ANSWER_BUDGET), scope, faces(core.ANSWER_BUDGET))).toBe(faces(core.ANSWER_BUDGET));
    expect((await core.boundAnswer(faces(core.ANSWER_BUDGET + 1), scope, faces(core.ANSWER_BUDGET + 1))).facts.get('characters')).toBe(core.ANSWER_BUDGET + 1);
  });

  it('answers a failure as its alert within the budget [D397]', async () => {
    const scope = await core.langRuntime();
    const failure = await core.evalQuery(':number/inf ~(add 1 | inf) | 0 | inf', scope);
    const shown = await core.boundAnswer(failure, scope);
    expect(shown.tag).toEqual(failure.tag);
    expect(core.printValue(shown).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
    expect(core.printValue(failure).length).toBeGreaterThan(core.ANSWER_BUDGET);
  });

  it('hands a word of a host the state of its call where it marks its primitive as a reader of it [D397]', async () => {
    const primitive = core.readingState((subject, state) => state.scope.has('k'));
    const session = await core.createSession({ sources: [{ uri: 'probe', source: ':any/where (::fn | returns |~~ W. ~~| ::boolean | impl ::builtin{})', primitives: { 'any/where': primitive } }] });
    expect((await session.evalCell('1 | where')).result).toBe(false);
    expect((await session.evalCell(':k 5 | 1 | where')).result).toBe(true);
  });

  it('prints every part of a kind of the root by the print a host source declares under its label, bare or under a tag [D400]', async () => {
    const session = await core.createSession({ sources: [{ uri: 'probe', source: ':number/print ~("h")' }] });
    expect((await session.evalCell('[::Box#5 7 "s"] | print')).result).toBe('[h h "s"]');
  });

  it('crosses the JSON boundary both ways', () => {
    const lifted = core.fromPlain({ name: 'alice' });
    expect(core.toPlain(lifted)).toEqual({ name: 'alice' });
  });

  it('hands the tools the parts of a text and the letters of a name', () => {
    const root = core.partOf(core.parse(':x 1 | x'));
    expect(core.findNameOccurrences(root, 'x')).toHaveLength(2);
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

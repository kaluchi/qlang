import { it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';

it('answers an answer whose print fits the budget as it is, a part a kind prints its own way counted as it prints', async () => {
  const notebook = await core.createNotebook();
  const cell = await notebook.evalCell(`:Box |~~ B ~~| | :Box/print ~("b") | ${core.ANSWER_BUDGET} | range | map ~(tag ::Box) | take ${core.ANSWER_BUDGET / 2 - 1}`);
  const shown = await core.boundAnswer(cell.result, cell.scopeAfterCell);
  expect(shown).toBe(cell.result);
  expect((await core.printAnswer(shown, cell.scopeAfterCell)).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
});

it('answers the refusal instead of an answer past the budget, its answer cut to an excerpt read from the answer', async () => {
  const scope = await core.langRuntime();
  const answer = await core.evalQuery('3000 | range | map ~(get {:id ~(it) :name "user"})', scope);
  const shown = await core.boundAnswer(answer, scope);
  expect(shown.tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
  expect([...shown.facts.keys()]).toEqual(['characters', 'budget', 'actualTag', 'actualValue']);
  expect(shown.facts.get('characters')).toBe((await core.printAnswer(answer, scope)).length);
  expect([shown.facts.get('budget'), shown.facts.get('actualTag')]).toEqual([core.ANSWER_BUDGET, core.makeTag('vec')]);
  expect(await core.printAnswer(shown.facts.get('actualValue'), scope)).toMatch(/^\[\{:id 0 :name "user"\} [\s\S]*::elision\{:size \d+ :read ~\(drop \d+\)\}\]$/);
});

it('measures the text a host writes for a string, as the host hands it', async () => {
  const scope = await core.langRuntime();
  const text = 'x'.repeat(core.ANSWER_BUDGET);
  expect(await core.boundAnswer(text, scope, text)).toBe(text);
  expect((await core.boundAnswer(`${text}x`, scope, `${text}x`)).tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
});

it('lets an answer past the budget give way whole as its head where no cut fits the excerpt, read beneath !| for a failure', async () => {
  const scope = await core.langRuntime();
  const query = '400 | range | map ~("k") | join "" | :long it | 3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | :m it | get [[~(long | toKeyword) 1]] | toMap | union m';
  const headOf = async written => (await core.boundAnswer(await core.evalQuery(written, scope), scope)).facts.get('actualValue');
  const [ofTheAnswer, ofTheFailure, ofATagged] = [await headOf(query), await headOf(`${query} | raise`), await headOf(`${query} | tag ::Big | raise`)];
  expect([ofTheAnswer.get('size'), core.printValue(ofTheAnswer.get('read')), core.printValue(ofTheFailure.get('read')), core.printValue(ofATagged.get('read'))]).toEqual([3001, '~()', '~(!| it)', '~(!| it)']);
});

it('counts the characters of a print as count counts a string', async () => {
  const scope = await core.langRuntime();
  const faces = count => '\u{1F600}'.repeat(count);
  expect(await core.boundAnswer(faces(core.ANSWER_BUDGET), scope, faces(core.ANSWER_BUDGET))).toBe(faces(core.ANSWER_BUDGET));
  expect((await core.boundAnswer(faces(core.ANSWER_BUDGET + 1), scope, faces(core.ANSWER_BUDGET + 1))).facts.get('characters')).toBe(core.ANSWER_BUDGET + 1);
});

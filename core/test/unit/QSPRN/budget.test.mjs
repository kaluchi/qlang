import { it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';

it('answers an answer whose print fits the budget as it is, a part a kind prints its own way counted as it prints', async () => {
  const notebook = await core.createNotebook();
  const cell = await notebook.evalCell(`:Box |~~ B ~~| | :Box/print ~("b") | ${core.ANSWER_BUDGET} | range | map ~(tag ::Box) | take ${core.ANSWER_BUDGET / 2 - 1}`);
  const shown = await core.boundAnswer(cell.result, cell.scopeAfterCell);
  expect(shown).toBe(cell.result);
  expect((await core.printAnswer(shown, cell.scopeAfterCell)).length).toBeLessThanOrEqual(core.ANSWER_BUDGET);
});

it('answers the refusal instead of an answer past the budget, the answer shown as its excerpt', async () => {
  const scope = await core.langRuntime();
  const answer = await core.evalQuery('3000 | range | map ~(get {:id ~(it) :name "user"})', scope);
  const shown = await core.boundAnswer(answer, scope);
  expect(shown.tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
  expect([...shown.facts.keys()]).toEqual(['characters', 'budget', 'answer']);
  expect(shown.facts.get('characters')).toBe((await core.printAnswer(answer, scope)).length);
  const excerpt = shown.facts.get('answer');
  expect([shown.facts.get('budget'), excerpt.get('of'), excerpt.get('count'), excerpt.get('parts').get('0')]).toEqual([core.ANSWER_BUDGET, core.makeTag('vec'), 3000, answer[0]]);
});

it('names the cell its host keeps the answer in, where the host keeps one', async () => {
  const scope = await core.langRuntime();
  const answer = await core.evalQuery('5000 | range', scope);
  const cell = await core.evalQuery('::cell"a3f9c2d1e04b"', scope);
  const kept = [];
  const shown = await core.boundAnswer(answer, scope, null, async whole => {
    kept.push(whole);
    return cell;
  });
  expect([shown.facts.get('cell'), kept]).toEqual([cell, [answer]]);
});

it('measures the text a host writes for a string, as the host hands it', async () => {
  const scope = await core.langRuntime();
  const text = 'x'.repeat(core.ANSWER_BUDGET);
  expect(await core.boundAnswer(text, scope, text)).toBe(text);
  expect((await core.boundAnswer(`${text}x`, scope, `${text}x`)).tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
});

it('counts the characters of a print as count counts a string', async () => {
  const scope = await core.langRuntime();
  const faces = count => '\u{1F600}'.repeat(count);
  expect(await core.boundAnswer(faces(core.ANSWER_BUDGET), scope, faces(core.ANSWER_BUDGET))).toBe(faces(core.ANSWER_BUDGET));
  expect((await core.boundAnswer(faces(core.ANSWER_BUDGET + 1), scope, faces(core.ANSWER_BUDGET + 1))).facts.get('characters')).toBe(core.ANSWER_BUDGET + 1);
});

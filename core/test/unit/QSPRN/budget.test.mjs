import { it, expect } from 'vitest';
import * as core from '../../../src/index.mjs';

it('answers the refusal instead of an answer past the budget, the answer told by its tag and the views of its kind where its host keeps no cell', async () => {
  const scope = await core.langRuntime();
  const answer = await core.evalQuery('3000 | range | map (get {:id it :name "user"})', scope);
  const shown = await core.boundAnswer(answer, scope);
  expect(shown.tag).toEqual(core.makeTag('qlang/AnswerBeyondBudgetError'));
  expect([...shown.facts]).toEqual([['characters', (await core.printAnswer(answer, scope)).length], ['budget', core.ANSWER_BUDGET], ['answer/tag', core.makeTag('vec')], ['answer/count', 3000], ['answer/shape', await core.evalQuery('::shape[{:id ::number :name ::string}]', scope)], ['answer/first', answer[0]], ['answer/last', answer[2999]]]);
});

it('names the cell its host keeps the answer in as its answer, where the host keeps one', async () => {
  const scope = await core.langRuntime();
  const answer = await core.evalQuery('5000 | range', scope);
  const cell = await core.evalQuery('::cell"a3f9c2d1e04b"', scope);
  const kept = [];
  const shown = await core.boundAnswer(answer, scope, null, async whole => {
    kept.push(whole);
    return cell;
  });
  expect([shown.facts.get('answer'), shown.facts.get('answer/count'), kept]).toEqual([cell, 5000, [answer]]);
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

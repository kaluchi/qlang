import { it, expect } from 'vitest';
import { answerText } from '../../src/render.mjs';
import { runQuery } from '../../src/run.mjs';
import { silentStreams } from '../helpers/silent-streams.mjs';
import { langRuntime, evalQuery, boundAnswer } from '@kaluchi/qlang-core';

// Every answer prints within one budget: an answer whose print fits prints
// whole, one past it as the refusal in its place, and a failure as its alert
// within the budget.
const forty = Array.from({ length: 40 }, (_, index) => index + 1);
const past = '3000 | range | map ~(get {:id ~(it) :name "user"})';

it('writes an answer whose print fits the budget whole', async () => {
  expect(await answerText(forty, await langRuntime())).toBe(`[${forty.join(' ')}]`);
});

it('writes the first screen whole, the budget never smaller than it', async () => {
  const cellEntry = await runQuery('[::qlang ::cli] | map ~(get [~(it) ~(doc)])', silentStreams);
  expect(await boundAnswer(cellEntry.result, cellEntry.scopeAfterCell)).toBe(cellEntry.result);
});

it('writes an answer past the budget as the refusal, its head read from the answer, above the prose of its page', async () => {
  const scope = await langRuntime();
  const text = await answerText(await evalQuery(past, scope), scope);
  expect(text).toMatch(/^\|~\| raised, and no !\| caught it\n::qlang\/AnswerBeyondBudgetError!\{\n {2}:characters 70891\n {2}:budget 16000\n {2}:actualType ::vec\n {2}:actualValue \[\{:id 0 :name "user"\}/);
  expect(text).toMatch(/::elision\{:size \d+ :read ~\(drop \d+\)\}\]\n\}\n\|~\| /);
  expect(text).toContain('print | out');
});

it('writes a string past the budget as the refusal, the text it writes measured', async () => {
  const scope = await langRuntime();
  expect(await answerText('x'.repeat(16000), scope)).toBe('x'.repeat(16000));
  expect(await answerText('x'.repeat(16001), scope)).toContain(':characters 16001');
});

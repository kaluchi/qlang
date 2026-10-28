import { it, expect } from 'vitest';
import { answerText } from '../../src/render.mjs';
import { runQuery } from '../../src/run.mjs';
import { silentStreams } from '../helpers/silent-streams.mjs';
import { langRuntime, evalQuery, boundAnswer } from '@kaluchi/qlang-core';

const forty = Array.from({ length: 40 }, (_, index) => index + 1);
const past = '3000 | range | map ~(get {:id ~(it) :name "user"})';

it('writes an answer whose print fits the budget whole', async () => {
  expect(await answerText(forty, await langRuntime())).toBe(`[${forty.join(' ')}]`);
});

it('writes the first screen whole, the budget never smaller than it', async () => {
  const cellEntry = await runQuery('[::qlang ::host] | map ~(get [~(it) ~(doc)])', silentStreams);
  expect(await boundAnswer(cellEntry.result, cellEntry.scopeAfterCell)).toBe(cellEntry.result);
});

it('writes an answer past the budget as the refusal, the answer told by its tag and the views of its kind, above the prose of its page', async () => {
  const scope = await langRuntime();
  const text = await answerText(await evalQuery(past, scope), scope);
  expect(text).toMatch(/^\|~\| raised, and no !\| caught it\n::qlang\/AnswerBeyondBudgetError::excerpt\{\n {2}:characters 70891\n {2}:budget 16000\n {2}:answer\/tag ::vec\n {2}:answer\/count 3000\n {2}:answer\/shape ::shape\[\{:id ::number :name ::string\}\]\n {2}:answer\/first \{:id 0 :name "user"\}\n {2}:answer\/last \{:id 2999 :name "user"\}\n\}/);
  expect(text).toMatch(/\n\}\n\|~\| /);
  expect(text).toContain('`json | out`');
});

it('writes a string past the budget as the refusal, the text it writes measured', async () => {
  const scope = await langRuntime();
  expect(await answerText('x'.repeat(16000), scope)).toBe('x'.repeat(16000));
  expect(await answerText('x'.repeat(16001), scope)).toContain(':characters 16001');
});

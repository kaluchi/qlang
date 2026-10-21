import { describe, it, expect } from 'vitest';
import { answerText } from '../../src/render.mjs';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';

// Every answer prints within one budget: an answer whose print fits prints
// whole, one past it as the refusal in its place, and a failure as its alert
// within the budget [QSPRN#budget].
describe('answerText — the bound of the answer', () => {
  it('cuts the alert of a failure within the budget, its trace kept to its first frames', async () => {
    const scope = await langRuntime();
    const text = await answerText(await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf', scope), scope);
    expect(text).toContain(':read ~(!| get /trace | drop ');
  });

  it('writes a failure whose alert passes the budget as the refusal above the prose of the refusal\'s page', async () => {
    const scope = await langRuntime();
    const failure = await evalQuery('3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise', scope);
    const text = await answerText(failure, scope, 'The page of the failure.');
    expect([text.includes('::qlang/AnswerBeyondBudgetError!{'), text.includes('print | out'), text.includes('The page of the failure.')]).toEqual([true, true, false]);
  });
});

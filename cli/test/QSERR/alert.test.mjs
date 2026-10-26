import { it, expect, beforeAll } from 'vitest';
import { answerText } from '../../src/render.mjs';
import { langRuntime, evalQuery } from '@kaluchi/qlang-core';

let scope;
beforeAll(async () => {
  scope = await langRuntime();
});

const alertOf = text => text.split('\n').filter(line => !line.startsWith('|~|')).join('\n');

it('writes the alert of a runaway recursion within its room, its trace shown as the excerpt of its frames', async () => {
  const text = await answerText(await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf', scope), scope);
  expect(alertOf(text)).toMatch(/:trace ::excerpt\{\n\s+:of ::trace\n\s+:count 1001\n/);
  expect(alertOf(text).length).toBeLessThanOrEqual(2000);
}, 60_000);

it('writes a failure of more facts than its room holds as the alert of its first facts, above the prose of its page', async () => {
  const failure = await evalQuery('3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise', scope);
  const text = await answerText(failure, scope, 'The page of the failure.');
  expect([text.startsWith('|~| raised, and no !| caught it\n!{\n  :"0k" 0\n'), alertOf(text).length <= 2000, text.includes(':trace'), text.includes('The page of the failure.')]).toEqual([true, true, false, true]);
});

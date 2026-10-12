// The first page [D185]: every example it states the answer of answers
// it as the page writes it, the task over the input the page gives it.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { deepEqual } from '../../src/equality.mjs';

const content = await evalQuery('::qlang | doc | content');

// `query` answers `answer`, or answering, and a task, Over `input`,
// `query` answers `answer`.
const EXAMPLE = /(?:Over\s+`([^`]+)`,\s+)?`([^`]+)`\s+(?:answers|answering)\s+`([^`]+)`/g;

const examples = [...content.matchAll(EXAMPLE)].map(([, input, query, answer]) => ({
  query: input === undefined ? query : `${input} | ${query}`,
  answer
}));

describe('the first page [D185]', () => {
  it('states the answers of its examples', () => {
    expect(examples.length).toBeGreaterThan(20);
  });

  it.each(examples)('$query answers $answer', async ({ query, answer }) => {
    expect(deepEqual(await evalQuery(query), await evalQuery(answer))).toBe(true);
  });
});

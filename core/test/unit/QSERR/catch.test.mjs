import { it, expect } from 'vitest';
import { evalQuery, createNotebook } from '../../../src/notebook.mjs';
import { QlangDefect } from '../../../src/errors.mjs';
import { makeKeyword, makeTag } from '../../../src/types.mjs';

it('a failure in the pipe skips raise', async () => {
  const evalResult = await evalQuery('("not-a-number" | add 1) | raise !| tag');
  expect(evalResult).toEqual(makeTag('number/add/SubjectNotNumberError'));
});

it('a verb called by `!|` runs its steps on the error at rest', async () => {
  const evalResult = await evalQuery(':any/handler ~(get /kind); !{:kind :oops} | raise !| handler');
  expect(evalResult).toEqual(makeKeyword('oops'));
});

it('`settle` holds the failure of a question as its outcome and passes a defect of its host past it', async () => {
  const collapsing = await createNotebook({
    sources: [{ uri: 'tests/collapse', source: ':any/collapse ::builtin{};', primitives: { 'any/collapse': () => { throw new QlangDefect('a defect of the host'); } } }]
  });
  await expect(evalQuery('42 | settle [~(add 1) ~(collapse)]', collapsing.scope)).rejects.toBeInstanceOf(QlangDefect);
});

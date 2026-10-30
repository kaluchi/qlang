import { it, expect } from 'vitest';
import { langRuntime } from '../../../src/runtime/lang-runtime.mjs';
import { ROOT_KEY } from '../../../src/scope-keys.mjs';
import { createNotebook } from '../../../src/notebook.mjs';

it('a source of the root that declares nothing adds no node to the root', async () => {
  const { createNotebook } = await import('../../../src/notebook.mjs');
  const notebook = await createNotebook({ sources: [{ uri: 'tests/atom-only', source: '42' }] });
  expect([...notebook.scope.get(ROOT_KEY).keys()]).toEqual([...(await langRuntime()).get(ROOT_KEY).keys()]);
});

it('a notebook starts from the scope of the root', async () => {
  const sessionInstance = await createNotebook();
  expect(sessionInstance.scope).toBeInstanceOf(Map);
  expect((await sessionInstance.evalCell('[1 2 3] | filter (gt 1) | count')).result).toBe(2);
});

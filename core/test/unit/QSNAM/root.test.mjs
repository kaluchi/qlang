import { describe, it, expect } from 'vitest';
import { langRuntime } from '../../../src/runtime/index.mjs';
import { ROOT_KEY } from '../../../src/scope-keys.mjs';
import { createSession } from '../../../src/session.mjs';

describe('::name | source answers the quote of the declarations under the name', () => {
  it('a source of the root that declares nothing adds no node to the root', async () => {
    const { createSession } = await import('../../../src/session.mjs');
    const session = await createSession({ sources: [{ uri: 'tests/atom-only', source: '42' }] });
    expect([...session.scope.get(ROOT_KEY).keys()]).toEqual([...(await langRuntime()).get(ROOT_KEY).keys()]);
  });
});

describe('createSession lifecycle', () => {
  it('creates a session seeded with the scope of the root', async () => {
    const sessionInstance = await createSession();
    expect(sessionInstance.scope).toBeInstanceOf(Map);
    expect((await sessionInstance.evalCell('[1 2 3] | filter ~(gt 1) | count')).result).toBe(2);
  });
});

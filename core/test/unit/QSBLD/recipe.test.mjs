import { describe, it, expect } from 'vitest';
import { createSession } from '../../../src/session.mjs';

describe('a verb a later source declares as a function', () => {
  it('runs by its function, its recipe reading its input past a value of the reader of the name', async () => {
    const hosted = await createSession({ sources: [{ uri: 'test/twice', source: ':number/twice ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by | add by)]' }] });
    expect((await hosted.evalCell(':by 99 | 5 | twice 1')).result).toBe(7);
  });
});

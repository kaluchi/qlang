import { it, expect } from 'vitest';
import { createNotebook } from '../../../src/notebook.mjs';

it('a verb a later source declares as a function runs by it, its recipe reading its input past a value of the reader of the name', async () => {
  const hosted = await createNotebook({ sources: [{ uri: 'test/twice', source: ':number/twice ::fn[~(takes :by |~~ How much. ~~| /0) ~(add by | add by)]' }] });
  expect((await hosted.evalCell('5 | apply ~(:by 99 | twice 1)')).result).toBe(7);
});

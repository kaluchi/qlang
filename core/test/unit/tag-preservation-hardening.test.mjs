// A vector under a tag nothing declares keeps its tag through a word whose
// answer is its subject's kind, `take` among them [QSDSP#answer].

import { describe, it, expect } from 'vitest';
import { evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { makeTagged, makeTag, typeKeyword } from '../../src/types.mjs';

describe('a tag nothing declares stays over the answer of a word of its subject\'s own kind', () => {
  // A tag nothing declares lays itself over the answer as it is
  // [QSDSP#answer], [QSLIT#tag].
  async function transform(tagged, src) {
    const state = rootState(tagged, await langRuntime());
    return (await evalAst(parse(src), state)).pipeValue;
  }

  it('take keeps a tag nothing declares over a vector a host built', async () => {
    const result = await transform(makeTagged(makeTag('Box'), [1, 2, 3]), 'take 1');
    expect(typeKeyword(result).name).toBe('Box');
    expect([...result]).toEqual([1]);
  });
});

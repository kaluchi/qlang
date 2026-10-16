// A tagged vector whose tag the environment does not declare, one a
// host built with makeTagged, keeps its tag through a verb that
// returns its subject [QSBLD#input]. Only JavaScript builds such a value, so
// the tests inspect the answer directly.

import { describe, it, expect } from 'vitest';
import { evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { makeTagged, makeTag, typeKeyword } from '../../src/types.mjs';

describe('an undeclared tag survives a verb that returns its subject', () => {
  // The tag carries no constructor, so `mintTagged` lays it over the answer
  // as it is, and an absent binding is no throw [QSDSP#answer].
  async function transform(tagged, src) {
    const state = rootState(tagged, await langRuntime());
    return (await evalAst(parse(src), state)).pipeValue;
  }

  it('take on a host-built unbound tagged Vec keeps the tag', async () => {
    const result = await transform(makeTagged(makeTag('Box'), [1, 2, 3]), 'take 1');
    expect(typeKeyword(result).name).toBe('Box');
    expect([...result]).toEqual([1]);
  });
});

// A tagged vector whose tag the environment does not declare, one a
// host built with makeTaggedInstance or read back from tagged JSON,
// keeps its tag through a verb that returns its subject [D67]. Only
// JavaScript builds such a value, so the tests inspect the answer
// directly.

import { describe, it, expect } from 'vitest';
import { evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { fromTaggedJSON } from '../../src/codec.mjs';
import { makeTaggedInstance, makeTagKeyword, typeKeyword } from '../../src/types.mjs';

describe('an undeclared tag survives a verb that returns its subject', () => {
  // The tag carries no constructor, so `mintUnderTag` lays it over the
  // answer without calling mintTaggedInstance, and an absent binding is
  // no throw.
  async function transform(tagged, src) {
    const state = rootState(tagged, await langRuntime());
    return (await evalAst(parse(src), state)).pipeValue;
  }

  it('take on a host-built unbound tagged Vec keeps the tag', async () => {
    const result = await transform(makeTaggedInstance(makeTagKeyword('Box'), [1, 2, 3]), 'take 1');
    expect(typeKeyword(result).name).toBe('Box');
    expect([...result]).toEqual([1]);
  });

  it('reverse on a tagged Vec deserialized from tagged-JSON keeps the tag', async () => {
    const tagged = fromTaggedJSON({ $tagged: { $tag: 'Box', payload: [1, 2, 3] } });
    const result = await transform(tagged, 'reverse');
    expect(typeKeyword(result).name).toBe('Box');
    expect([...result]).toEqual([3, 2, 1]);
  });
});

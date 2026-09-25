// Hardening invariants for the dispatch-level
// `applyTagPreservation` post-pass:
//
// - preservesTag operands returning a primitive (a contract
//   violation today, but a future-proof guard) flow through the
//   post-pass without a TypeError on `result[TAG_HEADER_SYMBOL]`.
//
// Both invariants are JS-side observable only — there is no
// qlang-surface query that catches them. Unit tests inspect the
// produced value directly.

import { describe, it, expect } from 'vitest';
import { evalAst } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { fromTaggedJSON } from '../../src/codec.mjs';
import { makeTaggedInstance, makeTagKeyword, typeKeyword } from '../../src/types.mjs';

describe('applyTagPreservation — unbound tag survives shape-preserving transforms', () => {
  // A tagged instance whose tag is NOT bound in env (host-built via
  // makeTaggedInstance, or deserialized from tagged-JSON) flows
  // through the identity path of applyTagPreservation — the
  // `isQMap(resolved) && resolved.has('impl')` gate is false, so the
  // post-pass stamps the header directly and never calls
  // mintTaggedInstance. Guards that the auto-declaration moving out of
  // mintTaggedInstance did not turn an absent binding into a throw.
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

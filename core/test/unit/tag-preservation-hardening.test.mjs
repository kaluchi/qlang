// Hardening invariants for the dispatch-level
// `applyTagPreservation` post-pass:
//
// - Untagged JsonArray results from preservesTag operands are
//   frozen — `containerLikeOf` defers the freeze so the optional
//   tag-header stamp lands first; the dispatch post-pass freezes
//   in both branches (tagged and untagged).
// - preservesTag operands returning a primitive (a contract
//   violation today, but a future-proof guard) flow through the
//   post-pass without a TypeError on `result[TAG_HEADER_SYMBOL]`.
//
// Both invariants are JS-side observable only — there is no
// qlang-surface query that catches them. Unit tests inspect the
// produced value directly.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isJsonArray } from '../../src/types.mjs';

describe('applyTagPreservation — JsonArray freeze hardening', () => {
  it('freezes untagged JsonArray after a preservesTag operand (filter)', async () => {
    const result = await evalQuery('::json[1 2 3] | filter(gt(1))');
    expect(isJsonArray(result)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('freezes untagged JsonArray after sort', async () => {
    const result = await evalQuery('::json[3 1 2] | sort');
    expect(isJsonArray(result)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('freezes untagged JsonArray after take', async () => {
    const result = await evalQuery('::json[1 2 3 4] | take(2)');
    expect(isJsonArray(result)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('freezes untagged JsonArray after reverse', async () => {
    const result = await evalQuery('::json[1 2 3] | reverse');
    expect(isJsonArray(result)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('freezes tagged-instance JsonArray after a preservesTag operand', async () => {
    const result = await evalQuery('::Box {} | ::Box(::json[1 2 3]) | filter(gt(1))');
    expect(Object.isFrozen(result)).toBe(true);
  });
});

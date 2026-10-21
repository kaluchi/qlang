import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { keyword, makeTag } from '../../../src/types.mjs';
// ── raise ──────────────────────────────────────────────

describe('raise', () => {
  it('a failure in the pipe skips raise', async () => {
    const evalResult = await evalQuery('("not-a-number" | add 1) | raise !| type');
    expect(evalResult).toEqual(makeTag('number/add/SubjectNotNumberError'));
  });
});

// ── `!|` runs a verb ───────────────────────────────────────────

describe('`!|` runs a verb on the error at rest', () => {
  it('a verb called by `!|` runs its steps on the error at rest', async () => {
    const evalResult = await evalQuery(':any/handler ~(get /kind) | !{:kind :oops} | raise !| handler');
    expect(evalResult).toEqual(keyword('oops'));
  });
});

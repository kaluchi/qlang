import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../../src/session.mjs';
import { isErrorValue, makeTag } from '../../../src/types.mjs';
// ── raise ──────────────────────────────────────────────

describe('raise', () => {
  it('an error literal under the address of a refusal, raised, keeps every fact it writes', async () => {
    const err = await evalQuery('::number/add/SubjectNotNumberError!{:custom "field" :note 42} | raise');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTag('number/add/SubjectNotNumberError'));
    expect(err.facts.get('custom')).toBe('field');
    expect(err.facts.get('note')).toBe(42);
  });

  it('raise takes the tag the map carries and keeps every entry a fact', async () => {
    // A `:kind` entry names no tag [QSERR#rest]: the tag is the map's own.
    const result = await evalQuery(':MyTag |~~ MyTag. ~~| | ::MyTag{:kind ::Other :detail "x"} | raise');
    expect(result.tag.name).toBe('MyTag');
    expect(result.facts.get('kind')).toEqual(makeTag('Other'));
    expect(result.facts.get('detail')).toBe('x');
  });
});

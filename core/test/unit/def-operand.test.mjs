// Tests for def operand — pipeline-transparent declarative binding
// across 1-arg / 2-arg / 3-arg forms, plus arity / shape error paths.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword, makeTagKeyword } from '../../src/types.mjs';

describe('def — 1-arg form (pure-doc binding)', () => {
  it('binds a Doc-value when the attached doc-prefix is present', async () => {
    const result = await evalQuery('|~~ A guide. ~~|\ndef(:guide)\n| reify(:guide) | /type');
    expect(result).toEqual(keyword('doc'));
  });

  it('the bound value content matches the attached doc', async () => {
    const result = await evalQuery('|~~ A guide. ~~|\ndef(:guide)\n| guide | /content');
    expect(result).toBe(' A guide. ');
  });

  it('raises DefMissingDocOrBody without attached doc', async () => {
    const err = await evalQuery('def(:nodoc)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DefMissingDocOrBody'));
  });
});

describe('def — 2-arg form purity-analysis', () => {
  it('pure scalar literal lands as a snapshot', async () => {
    const result = await evalQuery('def(:pi, 3.14) | reify(:pi) | /kind');
    expect(result).toEqual(keyword('snapshot'));
  });

  it('pure Vec literal lands as a snapshot', async () => {
    const result = await evalQuery('def(:xs, [1 2 3]) | reify(:xs) | /kind');
    expect(result).toEqual(keyword('snapshot'));
  });

  it('impure body containing OperandCall lands as a conduit', async () => {
    const result = await evalQuery('def(:double, mul(2)) | reify(:double) | /kind');
    expect(result).toEqual(keyword('conduit'));
  });

  it('snapshot lookup returns the eval-at-def-time value', async () => {
    expect(await evalQuery('def(:answer, 42) | answer')).toBe(42);
  });

  it('conduit lookup fires the deferred body against pipeValue', async () => {
    expect(await evalQuery('def(:double, mul(2)) | 5 | double')).toBe(10);
  });
});

describe('def — 3-arg parametric form', () => {
  it('always lands as a conduit regardless of body shape', async () => {
    const result = await evalQuery('def(:wrap, [], [1 2 3]) | reify(:wrap) | /kind');
    expect(result).toEqual(keyword('conduit'));
  });

  it('parametric conduit binds captured args as lazy proxies', async () => {
    expect(await evalQuery('def(:@surround, [:pfx :sfx], prepend(pfx) | append(sfx)) | "x" | @surround("[", "]")'))
      .toBe('[x]');
  });
});

describe('def — arity / shape error paths', () => {
  it('raises DefArityInvalid for zero-arg call', async () => {
    const err = await evalQuery('def()');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DefArityInvalid'));
  });

  it('raises DefArityInvalid for 4-arg call', async () => {
    const err = await evalQuery('def(:n, [], 1, 2)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DefArityInvalid'));
  });

  it('raises DefNameNotKeyword when name is not a keyword', async () => {
    const err = await evalQuery('def(42, mul(2))');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DefNameNotKeyword'));
  });

  it('raises DefParamsNotVecOfKeywords when params is not a Vec', async () => {
    const err = await evalQuery('def(:n, 42, mul(2))');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DefParamsNotVecOfKeywords'));
  });

  it('raises DefParamsNotVecOfKeywords when an element of params is not a keyword', async () => {
    const err = await evalQuery('def(:n, [42], mul(2))');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('DefParamsNotVecOfKeywords'));
  });
});

describe('def — pipeline-transparency', () => {
  it('subject pipeValue passes through unchanged', async () => {
    expect(await evalQuery('"input" | def(:x, 1)')).toBe('input');
  });
});

describe('def — effect-laundering safety net', () => {
  it('rejects effectful body under non-@-prefixed name', async () => {
    const err = await evalQuery('def(:safe, @nonExistent)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('EffectLaunderingAtDefParse'));
  });

  it('rejects effectful body under non-@-prefixed BindStep form', async () => {
    const err = await evalQuery(':safe @nonExistent');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('EffectLaunderingAtDefParse'));
  });
});

describe('BindStep — declarative conduit form', () => {
  // BindStep with an impure body parses to a Conduit just like
  // `def(:name, body)` does — exercises the params=null fall-through
  // through evalBindStep's effect-laundering check and conduit
  // creation. The def(…) operand path bypasses evalBindStep, so
  // these tests are the only coverage for that branch.
  it(':double mul(2) — zero-param conduit invokable by name', async () => {
    const result = await evalQuery(':double mul(2) | 5 | double');
    expect(result).toBe(10);
  });

  it(':@add1 [:x] add(x) — captured arg x binds the modifier (params non-null branch)', async () => {
    const result = await evalQuery(':@add1 [:x] add(x) | 5 | @add1(10)');
    expect(result).toBe(15);
  });
});

describe('BindStep — docs-only form binds a Doc-valued snapshot', () => {
  // A BindStep with a DocPrefix but no body. The bound value carries
  // the joined doc-content as a Doc, wrapped in a Snapshot under
  // the binding name. Round-trips via `binding-name | reify | /value`
  // or, for direct subject lookup, by referencing the identifier.
  it(':name |~~| only-docs binds the joined doc-content as a Doc value', async () => {
    const { describeType } = await import('../../src/types.mjs');
    const doc = await evalQuery(':forward |~~| placeholder note\n| forward');
    expect(describeType(doc)).toBe('Doc');
    expect(doc.content).toBe(' placeholder note');
  });
});

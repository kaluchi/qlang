// Tests for def operand — pipeline-transparent declarative binding
// across 1-arg / 2-arg / 3-arg forms, plus arity / shape error paths.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword } from '../../src/types.mjs';

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
    expect(err.descriptor.get('thrown')).toEqual(keyword('DefMissingDocOrBody'));
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
    expect(await evalQuery('def(:@surround, [:pfx, :sfx], prepend(pfx) | append(sfx)) | "x" | @surround("[", "]")'))
      .toBe('[x]');
  });
});

describe('def — arity / shape error paths', () => {
  it('raises DefArityInvalid for zero-arg call', async () => {
    const err = await evalQuery('def()');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(keyword('DefArityInvalid'));
  });

  it('raises DefArityInvalid for 4-arg call', async () => {
    const err = await evalQuery('def(:n, [], 1, 2)');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(keyword('DefArityInvalid'));
  });

  it('raises DefNameNotKeyword when name is not a keyword', async () => {
    const err = await evalQuery('def(42, mul(2))');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(keyword('DefNameNotKeyword'));
  });

  it('raises DefParamsNotVecOfKeywords when params is not a Vec', async () => {
    const err = await evalQuery('def(:n, 42, mul(2))');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(keyword('DefParamsNotVecOfKeywords'));
  });

  it('raises DefParamsNotVecOfKeywords when an element of params is not a keyword', async () => {
    const err = await evalQuery('def(:n, [42], mul(2))');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(keyword('DefParamsNotVecOfKeywords'));
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
    expect(err.descriptor.get('thrown')).toEqual(keyword('EffectLaunderingAtLetParse'));
  });
});

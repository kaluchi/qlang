// Binding declarations — BindStep (`:name body` / `:name [params]
// body`) and the `as` operand (pipeValue snapshot under a name).
// Every binding declaration parses through `evalBindStep` at the
// AST level — there is no operand-call ceremony around it.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword, makeTagKeyword, describeType } from '../../src/types.mjs';

describe('BindStep — docs-only form', () => {
  it('binds a Doc-value when the prefix is the only attached content', async () => {
    const result = await evalQuery(':guide |~~ A guide. ~~|\n| reify(:guide) | /type');
    expect(result).toEqual(keyword('doc'));
  });

  it('the bound value content matches the attached doc', async () => {
    const result = await evalQuery(':guide |~~ A guide. ~~|\n| guide | /content');
    expect(result).toBe(' A guide. ');
  });

  it(':name |~~| short-doc-only binds the joined doc-content as a Doc value', async () => {
    const doc = await evalQuery(':forward |~~| placeholder note\n| forward');
    expect(describeType(doc)).toBe('Doc');
    expect(doc.content).toBe(' placeholder note');
  });
});

describe('BindStep — value-body purity routing', () => {
  it('pure scalar literal lands as a snapshot', async () => {
    const result = await evalQuery(':pi 3.14 | reify(:pi) | /kind');
    expect(result).toEqual(keyword('snapshot'));
  });

  it('pure Vec literal lands as a snapshot', async () => {
    const result = await evalQuery(':xs [1 2 3] | reify(:xs) | /kind');
    expect(result).toEqual(keyword('snapshot'));
  });

  it('impure body containing OperandCall lands as a conduit', async () => {
    const result = await evalQuery(':double mul(2) | reify(:double) | /kind');
    expect(result).toEqual(keyword('conduit'));
  });

  it('snapshot lookup returns the eval-at-bind-time value', async () => {
    expect(await evalQuery(':answer 42 | answer')).toBe(42);
  });

  it('conduit lookup fires the deferred body against pipeValue', async () => {
    expect(await evalQuery(':double mul(2) | 5 | double')).toBe(10);
  });
});

describe('BindStep — parametric conduit form', () => {
  it('parametric conduit binds captured args as lazy proxies', async () => {
    expect(await evalQuery(':@surround [:pfx :sfx] (prepend(pfx) | append(sfx)) | "x" | @surround("[", "]")'))
      .toBe('[x]');
  });

  it(':@add1 [:x] add(x) — captured arg x binds the modifier', async () => {
    expect(await evalQuery(':@add1 [:x] add(x) | 5 | @add1(10)')).toBe(15);
  });
});

describe('BindStep — pipeline-transparency', () => {
  it('subject pipeValue passes through unchanged across a binding step', async () => {
    expect(await evalQuery('"input" | :x 1 | x')).toBe(1);
  });
});

describe('BindStep — effect-laundering safety net', () => {
  it('rejects an effectful body under a non-@-prefixed binding name', async () => {
    const err = await evalQuery(':safe @nonExistent');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('EffectLaunderingAtBindStepParse'));
  });
});

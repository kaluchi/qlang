// Binding declarations — BindStep (`:name body` / `:name [params]
// body`) and the `as` operand (pipeValue snapshot under a name).
// Every binding declaration parses through `evalBindStep` at the
// AST level — there is no operand-call ceremony around it.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword, makeTagKeyword, describeType } from '../../src/types.mjs';

describe('BindStep — docs-only form', () => {
  it('binds a Doc-value when the prefix is the only attached content', async () => {
    const result = await evalQuery(':guide |~~ A guide. ~~|\n| guide | type');
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

  it('::Tag |~~ ~~| doc-only auto-forges a ::builtin{} tag-binding under the tag-namespace key', async () => {
    // Tag-namespace doc-only BindStep (`::Tag |~~ docs ~~|`)
    // mints an empty `::builtin{}` descriptor under the `::Tag`
    // env key automatically — equivalent to `::Tag ::builtin{}`
    // body-form. The BindStep production requires docs (or body
    // or params) after the key; the doc-prefix attaches to the
    // BindStep, evalBindStep no-body branch fires the auto-forge.
    // Subsequent `::Tag | docs` axis lookup resolves the attached
    // prose, and `::Tag | spec | type` surfaces the ::builtin
    // identity through the JS-header tag slot.
    const doc = await evalQuery('::MyDocTag |~~ short tag prose ~~| | ::MyDocTag | docs | first | /content');
    expect(doc).toContain('short tag prose');
    const spec = await evalQuery('::MyDocTag |~~ short tag prose ~~| | ::MyDocTag | spec | type');
    expect(spec).toEqual(makeTagKeyword('builtin'));
  });
});

describe('BindStep — value-body purity routing', () => {
  // Pure-literal bodies land as Snapshot wrappers; identifier lookup
  // auto-unwraps to the captured value, so the user-observable
  // contract is "lookup yields the eval-at-bind-time value". The
  // snapshot wrapper is internal — there is no user-facing axis
  // that surfaces it.

  it('pure scalar literal lookup yields the literal value', async () => {
    expect(await evalQuery(':pi 3.14 | pi')).toBe(3.14);
  });

  it('pure Vec literal lookup yields the literal Vec', async () => {
    expect(await evalQuery(':xs [1 2 3] | xs')).toEqual([1, 2, 3]);
  });

  it('impure body containing OperandCall fires the deferred body per call', async () => {
    expect(await evalQuery(':double mul(2) | 5 | double')).toBe(10);
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

describe('BindStep — effectLaundering safety net', () => {
  it('rejects an effectful body under a non-@-prefixed binding name', async () => {
    const err = await evalQuery(':safe @nonExistent');
    expect(isErrorValue(err)).toBe(true);
    expect(err.tag).toEqual(makeTagKeyword('EffectLaunderingAtBindStepParseError'));
  });
});

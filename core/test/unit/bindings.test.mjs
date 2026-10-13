// Binding declarations — BindStep (`:name body`), the freeze
// `:name it` among them.
// Every binding declaration parses through `evalBindStep` at the
// AST level, with no call around it.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { makeTag, formOf } from '../../src/types.mjs';
import { docText } from '../../src/quote.mjs';

describe('BindStep — docs-only form', () => {
  it('binds a Doc-value when the prefix is the only attached content', async () => {
    const result = await evalQuery(':guide |~~ A guide. ~~|\n| guide | type');
    expect(result).toEqual(makeTag('doc'));
  });

  it('the bound value content matches the attached doc', async () => {
    const result = await evalQuery(':guide |~~ A guide. ~~|\n| guide | content');
    expect(result).toBe(' A guide. ');
  });

  it(':name |~~| short-doc-only binds the joined doc-content as a Doc value', async () => {
    const doc = await evalQuery(':forward |~~| placeholder note\n| forward');
    expect(formOf(doc)).toBe('doc');
    expect(docText(doc)).toBe(' placeholder note');
  });

  it('a label declared by its page alone reads its page, the value of its record [D253]', async () => {
    const doc = await evalQuery(':MyDocTag |~~ short tag prose ~~| | ::MyDocTag | doc | content');
    expect(doc).toContain('short tag prose');
    const value = await evalQuery(':MyDocTag |~~ short tag prose ~~| | ::MyDocTag | binding | get /value | type');
    expect(value).toEqual(makeTag('doc'));
  });
});

describe('BindStep — value-body purity routing', () => {
  // A pure-literal body evaluates at declaration and its record holds
  // the value [D5]; identifier lookup reads it, so the
  // user-observable contract is "lookup yields the eval-at-bind-time
  // value".

  it('pure scalar literal lookup yields the literal value', async () => {
    expect(await evalQuery(':pi 3.14 | pi')).toBe(3.14);
  });

  it('pure Vec literal lookup yields the literal Vec', async () => {
    expect(await evalQuery(':xs [1 2 3] | xs')).toEqual([1, 2, 3]);
  });

  it('impure body containing Call fires the deferred body per call', async () => {
    expect(await evalQuery(':any/double ~(mul 2) | 5 | double')).toBe(10);
  });

  it('lookup of a literal binding returns the eval-at-bind-time value', async () => {
    expect(await evalQuery(':answer 42 | answer')).toBe(42);
  });

  it('a verb lookup runs its body against pipeValue', async () => {
    expect(await evalQuery(':any/double ~(mul 2) | 5 | double')).toBe(10);
  });
});

describe('BindStep — a word with inputs', () => {
  it('a word binds its inputs from the modifiers of the call', async () => {
    expect(await evalQuery(':any/surround (::fn | takes :pfx |~~ The prefix. ~~| /0 | takes :sfx |~~ The suffix. ~~| /1 | impl ~(prepend pfx | append sfx)) | "x" | surround "[" "]"'))
      .toBe('[x]');
  });

  it('the input x binds the modifier', async () => {
    expect(await evalQuery(':any/add1 (::fn | takes :x |~~ How much. ~~| /0 | impl ~(add x)) | 5 | add1 10')).toBe(15);
  });
});

describe('BindStep — pipeline-transparency', () => {
  it('subject pipeValue passes through unchanged across a binding step', async () => {
    expect(await evalQuery('"input" | :x 1 | x')).toBe(1);
  });
});

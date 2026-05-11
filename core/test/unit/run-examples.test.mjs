// runExamples — execute each Quote segment in a binding's attached
// docs as an executable test case. Truthy result (anything not
// false / null / error-value) means pass. Subject can be a keyword
// (binding name) or a descriptor Map carrying a :name string.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';

describe('runExamples accepts both keyword and descriptor subjects', () => {
  it('keyword subject — :count | runExamples', async () => {
    const result = await evalQuery(':count | runExamples * /ok | distinct');
    expect(result).toEqual([true]);
  });

  it('descriptor subject — reify(:count) | runExamples', async () => {
    const result = await evalQuery('reify(:count) | runExamples * /ok | distinct');
    expect(result).toEqual([true]);
  });

  it('subject without a source-located def-step returns an empty Vec', async () => {
    // :def is bootstrap-installed — has no def-step in any
    // module. runExamples gracefully returns an empty Vec
    // rather than throwing AxisBindingNotFound.
    const result = await evalQuery(':def | runExamples');
    expect(result).toEqual([]);
  });

  it('non-keyword non-descriptor subject raises RunExamplesSubjectShapeError', async () => {
    const err = await evalQuery('42 | runExamples');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(keyword('RunExamplesSubjectShapeError'));
  });
});

describe('runExamples Quote-as-test outcomes', () => {
  it('Quote that lifts an error → ok:false with error message', async () => {
    const moduleSource =
      '|~~ broken example.\n    ~{"x" | add(1) | eq(42)} ~~|\n' +
      'def(:demo, 1)';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('null | use(:tests/broken) | :demo | runExamples | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(typeof cellEntry.result.get('error')).toBe('string');
  });

  it('Quote that evaluates falsy → ok:false with no error', async () => {
    // 5 | mul(2) = 10, eq(99) = false. The Quote eval'd cleanly
    // but produced a falsy result, so runExamples reports ok:false
    // with :error nil — there is no error message, the assertion
    // just did not hold.
    const moduleSource =
      '|~~ falsy example.\n    ~{5 | mul(2) | eq(99)} ~~|\n' +
      'def(:demo, 1)';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('null | use(:tests/falsy) | :demo | runExamples | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error')).toBeNull();
    expect(cellEntry.result.get('actual')).toBe(false);
  });

  it('Quote that evaluates truthy → ok:true', async () => {
    const moduleSource =
      '|~~ ~{5 | mul(2) | eq(10)} ~~|\ndef(:demo, 1)';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('null | use(:tests/passing) | :demo | runExamples | first | /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('binding without an attached doc-prefix returns an empty Vec', async () => {
    const session = await createSession({
      locator: async () => ({ source: 'def(:bare, 42)' })
    });
    const cellEntry = await session.evalCell('null | use(:tests/bare) | :bare | runExamples | count');
    expect(cellEntry.result).toBe(0);
  });
});

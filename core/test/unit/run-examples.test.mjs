// runExamples — execute ::assertion segments embedded in a
// binding's attached docs. Subject can be a keyword (binding name)
// or a descriptor Map carrying a :name string.

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

describe('runExamples assertion error paths', () => {
  it('failing snippet → ok:false with error message', async () => {
    const moduleSource =
      '|~~ broken example.\n    ::assertion[~{"x" | add(1)} ~{42}] ~~|\n' +
      'def(:demo, 1)';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('null | use(:tests/broken) | :demo | runExamples | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(typeof cellEntry.result.get('error')).toBe('string');
  });

  it('failing :expected → ok:false', async () => {
    // The expected Quote evaluates to an error value (here a
    // call to an unbound identifier), so the assertion fails on
    // the expected side rather than the snippet side.
    const moduleSource =
      '|~~ broken expected.\n    ::assertion[~{42} ~{nonExistentBinding}] ~~|\n' +
      'def(:demo, 1)';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('null | use(:tests/broken) | :demo | runExamples | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error')).toMatch(/^expected:/);
  });

  it('matching snippet/expected → ok:true', async () => {
    const moduleSource =
      '|~~ ::assertion[~{5 | mul(2)} ~{10}] ~~|\ndef(:demo, 1)';
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

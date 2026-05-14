// runExamples — execute each Quote segment in a binding's attached
// docs as an executable test case. Truthy result (anything not
// false / null / error-value) means pass. Subject can be a keyword
// (binding name) or a descriptor Map carrying a :name string.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, makeTagKeyword } from '../../src/types.mjs';
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

  it('subject naming a binding without a source-located BindStep returns an empty Vec', async () => {
    // Host-installed bindings (via `session.bind`, or any binding
    // landed in env without an attached AST) carry no BindStep to
    // walk. runExamples gracefully returns an empty Vec rather
    // than throwing AxisBindingNotFoundError.
    const sessionInstance = await createSession();
    sessionInstance.bind('hostInjected', 42);
    const cellEntry = await sessionInstance.evalCell(':hostInjected | runExamples');
    expect(cellEntry.result).toEqual([]);
  });

  it('non-keyword non-descriptor subject raises RunExamplesSubjectShapeError', async () => {
    const err = await evalQuery('42 | runExamples');
    expect(isErrorValue(err)).toBe(true);
    expect(err.descriptor.get('thrown')).toEqual(makeTagKeyword('RunExamplesSubjectShapeError'));
  });
});

describe('runExamples Quote-as-test outcomes', () => {
  it('Quote that lifts an error → ok:false with error message', async () => {
    const moduleSource =
      '|~~ broken example.\n    ~{"x" | add(1) | eq(42)} ~~|\n' +
      ':demo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/broken) | :demo | runExamples | first');
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
      ':demo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/falsy) | :demo | runExamples | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error')).toBeNull();
    expect(cellEntry.result.get('actual')).toBe(false);
  });

  it('Quote that evaluates truthy → ok:true', async () => {
    const moduleSource =
      '|~~ ~{5 | mul(2) | eq(10)} ~~|\n:demo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/passing) | :demo | runExamples | first | /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('binding without an attached doc-prefix returns an empty Vec', async () => {
    const session = await createSession({
      locator: async () => ({ source: ':bare 42' })
    });
    const cellEntry = await session.evalCell('use(:tests/bare) | :bare | runExamples | count');
    expect(cellEntry.result).toBe(0);
  });

  it('Quote that lifts a user-built error → :error reads :message from descriptor', async () => {
    // User-built errors (via `error(map)` operand) carry no
    // `.originalError` on the JS-level ErrorValue wrapper —
    // `errorMessageOf` falls through to the descriptor's :message
    // entry. Distinct from finding #41's "Quote that lifts an error"
    // case where the JS throw routed through `errorFromQlang` and
    // the wrapper retained `.originalError`.
    const moduleSource =
      '|~~ user-built error.\n    ~{{:message "hand-built failure" :kind :test} | error}\n    ~~|\n' +
      ':demo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell('use(:tests/user-error) | :demo | runExamples | first');
    expect(cellEntry.result.get('ok')).toBe(false);
    expect(cellEntry.result.get('error')).toBe('hand-built failure');
  });
});

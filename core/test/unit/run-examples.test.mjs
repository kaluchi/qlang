// runExamples — execute each Quote segment in a binding's attached
// docs as an executable test case. Truthy result (anything not
// false / null / error-value) means pass. Subject can be a keyword
// (binding name) or a descriptor Map carrying a :name string —
// the Map shape is what `manifest` yields per entry, so
// `manifest * runExamples` walks the whole catalog without an
// intermediate name-projection step.

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, makeTagKeyword } from '../../src/types.mjs';
import { createSession } from '../../src/session.mjs';

describe('runExamples accepts both keyword and descriptor subjects', () => {
  it('keyword subject — :count | runExamples', async () => {
    const result = await evalQuery(':count | runExamples * /ok | distinct');
    expect(result).toEqual([true]);
  });

  it('descriptor subject — manifest-yielded Map with :name passes through', async () => {
    // `manifest` enumerates env into descriptor Maps carrying `:name`;
    // composing it with `* runExamples` per-entry covers the
    // Map-with-:name subject path on the runExamples contract.
    const result = await evalQuery('manifest | filter(/name | eq("count")) | first | runExamples * /ok | distinct');
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
    expect(err.descriptor.get('kind')).toEqual(makeTagKeyword('RunExamplesSubjectShapeError'));
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

  it('example sees module bindings loaded through the calling session', async () => {
    // The Quote inside `:fortytwo`'s doc-prefix references `add` —
    // an operand pulled in via `use(:qlang/operand/arith)` inside
    // the test's transient module. runExamples must evaluate the
    // Quote against the calling session's env so the operand
    // resolves; falling back to a fresh `langRuntime()` env would
    // leak the example into an isolated runtime that already has
    // `add` — masking the contract.
    //
    // The stronger surface is in the JDT module: `:@type`'s example
    // calls the host-bound `@type` operand. Without env propagation
    // the call would lift to `::UnresolvedIdentifierError`; with it
    // the operand fires against the live bridge and the example
    // verifies the documented fail-track tag. Coverage here uses
    // bare-qlang `add` to keep the test runtime-free.
    const moduleSource =
      '|~~ tracks env propagation through runExamples.\n' +
      '    ~{40 | add(2) | eq(42)}\n ~~|\n' +
      ':fortytwo 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellEntry = await session.evalCell(
      'use(:tests/env-propagation) | :fortytwo | runExamples | first | /ok');
    expect(cellEntry.result).toBe(true);
  });

  it('example does not leak BindStep writes back into the calling session', async () => {
    // The Quote in `:writer`'s prefix runs a BindStep — the
    // session-env copy isolates the write so the calling session
    // still sees no `:scratch` after runExamples completes. Reading
    // `:scratch` on the session after `runExamples` therefore lifts
    // ::UnresolvedIdentifierError.
    const moduleSource =
      '|~~ leaks BindStep into session env.\n' +
      '    ~{:scratch 99 | scratch | eq(99)}\n ~~|\n' +
      ':writer 1';
    const session = await createSession({
      locator: async () => ({ source: moduleSource })
    });
    const cellRun = await session.evalCell(
      'use(:tests/isolation) | :writer | runExamples | first | /ok');
    expect(cellRun.result).toBe(true);
    const cellProbe = await session.evalCell('scratch');
    expect(isErrorValue(cellProbe.result)).toBe(true);
    expect(cellProbe.result.descriptor.get('kind'))
      .toEqual(makeTagKeyword('UnresolvedIdentifierError'));
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

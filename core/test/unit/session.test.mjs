// Tests for session.mjs — REPL/notebook session lifecycle.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { keyword, makeTagKeyword, isErrorValue } from '../../src/types.mjs';
import { QlangTypeError, QlangInvariantError } from '../../src/errors.mjs';

describe('createSession lifecycle', () => {
  it('creates a session seeded with langRuntime builtins', async () => {
    const sessionInstance = await createSession();
    expect(sessionInstance.env).toBeInstanceOf(Map);
    expect(sessionInstance.env.has('count')).toBe(true);
    expect(sessionInstance.env.has('filter')).toBe(true);
  });

  it('evalCell returns an entry with its result', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.result).toBe(42);
    expect(cellEntry.error).toBeNull();
  });

  it('evalCell seeds the cell pipeValue from evalOpts.initialPipeValue', async () => {
    // The CLI script mode uses this hook to deliver parsed stdin
    // as the implicit subject — `qlang '/key'` then acts as a
    // pure filter without needing `@in | parseJson | …` ceremony.
    const sessionInstance = await createSession();
    const seeded = new Map([['a', 1], ['b', 2]]);
    const cellEntry = await sessionInstance.evalCell('/a', { initialPipeValue: seeded });
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(1);
  });

  it('evalCell omitting initialPipeValue falls back to env as the seed', async () => {
    // Historical behaviour — a query that starts with a value
    // producer (`42`, `[1 2]`, `@in`) overrides the seed anyway,
    // so a cell that does not reference pipeValue acts as before.
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(42);
  });

  it('evalCell persists BindStep bindings across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':double ::verb~(mul 2)');
    const cellEntry = await sessionInstance.evalCell('5 | double');
    expect(cellEntry.result).toBe(10);
  });

  it('evalCell persists freezes across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | :answer /');
    const cellEntry = await sessionInstance.evalCell('answer | mul 2');
    expect(cellEntry.result).toBe(84);
  });

  it('a cell opens a scope of its own, where a later cell declares a name again [D44]', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':k 1');
    const cellEntry = await sessionInstance.evalCell(':k 2 | k');
    expect(cellEntry.result).toBe(2);
  });

  it('evalCell records the error on parse failure', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('[1 2');
    expect(cellEntry.error).not.toBeNull();
    expect(cellEntry.error.name).toBe('ParseError');
  });

  it('evalCell records the error on runtime failure', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42 | count');
    // Runtime errors are error values (5th type).
    // evalCell succeeds; result is an error value, entry.error is null.
    expect(cellEntry.error).toBeNull();
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.originalError.name).toBe('VerbWithoutBodyError');
  });

  it('evalCell uri defaults to cell-N', async () => {
    const sessionInstance = await createSession();
    expect((await sessionInstance.evalCell('1')).uri).toBe('cell-1');
    expect((await sessionInstance.evalCell('2')).uri).toBe('cell-2');
  });

  it('evalCell uri respects evalOpts.uri', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('1', { uri: 'notebook.qlang#cell-foo' });
    expect(cellEntry.uri).toBe('notebook.qlang#cell-foo');
  });

  it('bind installs a raw value into env', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('answer', 42);
    expect((await sessionInstance.evalCell('answer')).result).toBe(42);
  });
});

describe('a module a locator hands', () => {
  it('runs a host verb through the implementation its module was handed with', async () => {
    const sessionInstance = await createSession({
      locator: async nsName => (nsName === 'tests/host'
        ? {
            source: ':less ::verb~(:by ::number | ::builtin{:impl :tests/host/less})',
            impls: { less: (subject, by) => subject - by }
          }
        : null)
    });
    expect((await sessionInstance.evalCell('use :tests/host | 7 | less 2')).result).toBe(5);
    expect((await sessionInstance.evalCell('use :tests/host | 7 | less "a" !| type')).result)
      .toEqual(makeTagKeyword('NumberPayloadNotNumberError'));
  });

  it('refuses an implementation handed for a name the source declares as no verb', async () => {
    const sessionInstance = await createSession({
      locator: async nsName => (nsName === 'tests/stray'
        ? { source: ':limit 10', impls: { limit: () => 1 } }
        : null)
    });
    expect((await sessionInstance.evalCell('use :tests/stray !| [type /implName]')).result)
      .toEqual([makeTagKeyword('UseImplNamesNoVerbError'), keyword('limit')]);
  });
});

// ── Locator-based lazy module loading ─────────────────────────

// Minimal .qlang source for a module with one host verb and one
// qlang-only verb that builds on it; the locator hands the host verb's
// implementation beside the source [D80]. Env delta = the exports.
const MOCK_MODULE_SOURCE = [
  ':@fetch ::verb~(:returns ::string | ::builtin{:impl :test/io/@fetch})',
  '| :@doubled ::verb~(@fetch | append @fetch)'
].join('\n');

// Host-provided impl for the @fetch builtin — returns a fixed string.
const fetchImpl = () => 'fetched-value';

function mockLocator(namespaceName) {
  if (namespaceName === 'test/io') {
    return { source: MOCK_MODULE_SOURCE, impls: { '@fetch': fetchImpl } };
  }
  return null;
}

describe('createSession with locator — lazy module loading', () => {
  it('installs locator under :qlang/locator in env', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    expect(locatorSession.env.has('qlang/locator')).toBe(true);
  });

  it('use(:ns) triggers locator when namespace not pre-installed', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    const loadCell = await locatorSession.evalCell('use :test/io | @fetch');
    expect(loadCell.error).toBeNull();
    expect(loadCell.result).toBe('fetched-value');
  });

  it('qlang-only verb in a locator-loaded module works', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    const verbCell = await locatorSession.evalCell('use :test/io | @doubled');
    expect(verbCell.error).toBeNull();
    expect(verbCell.result).toBe('fetched-valuefetched-value');
  });

  it('locator-loaded namespace keyword persists for subsequent use calls', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    await locatorSession.evalCell('use :test/io');
    // Second use of same namespace should not re-trigger locator.
    const secondUse = await locatorSession.evalCell('use :test/io | @fetch');
    expect(secondUse.error).toBeNull();
    expect(secondUse.result).toBe('fetched-value');
  });

  it('locator returning null falls through to UseNamespaceNotFoundError', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    const missingCell = await locatorSession.evalCell('use :nonexistent/ns');
    expect(missingCell.error).toBeNull();
    expect(isErrorValue(missingCell.result)).toBe(true);
    const locatorMissErr = missingCell.result.originalError;
    expect(locatorMissErr.name).toBe('UseNamespaceNotFoundError');
    expect(locatorMissErr).toBeInstanceOf(QlangTypeError);
    expect(locatorMissErr.context.namespaceName).toBe('nonexistent/ns');
  });

  it('the signature of a locator-loaded host verb answers its head', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    const specCell = await locatorSession.evalCell('use :test/io | :@fetch | spec | [type /returns]');
    expect(specCell.error).toBeNull();
    expect(specCell.result).toEqual([makeTagKeyword('spec'), makeTagKeyword('string')]);
  });

  it('session without locator throws UseNamespaceNotFoundError on unknown namespace', async () => {
    const plainSession = await createSession();
    const missingCell = await plainSession.evalCell('use :anything');
    expect(missingCell.error).toBeNull();
    expect(isErrorValue(missingCell.result)).toBe(true);
    const noLocatorErr = missingCell.result.originalError;
    expect(noLocatorErr.name).toBe('UseNamespaceNotFoundError');
    expect(noLocatorErr).toBeInstanceOf(QlangTypeError);
    expect(noLocatorErr.context.namespaceName).toBe('anything');
  });
});

describe('locator exports that are no descriptors of the core', () => {
  it('leaves a `::Tag` bound to a literal alone rather than stamping a throw-site spec onto it', async () => {
    const sessionInstance = await createSession({
      locator: async (namespaceName) => namespaceName === 'tests/literal-tag'
        ? { source: '::AsNameNotKeywordError 42' }
        : null
    });
    expect((await sessionInstance.evalCell('use :tests/literal-tag | ::AsNameNotKeywordError | spec')).result).toBe(42);
  });

  it('leaves the verb of a module named as a noun that declares no kind off the residences of its name', async () => {
    const sessionInstance = await createSession({
      locator: async (namespaceName) => namespaceName === 'qlang/widget'
        ? { source: ':count ::verb~(add 1) | :other 1' }
        : null
    });
    expect((await sessionInstance.evalCell('use :qlang/widget #[:other] | count [1 2]')).result).toBe(2);
  });
});

describe('a cell whose failure is no error value', () => {
  it('leaves an invariant failure on the error channel with no result value', async () => {
    // `evalAst` converts every failure into an ErrorValue except
    // QlangInvariantError, which travels as a host-level throw. The
    // cell records it on the error channel; only a ParseError also
    // lands a structured value on the result channel.
    const sessionInstance = await createSession({
      locator: async namespaceName => (namespaceName === 'tests/collapse'
        ? {
            source: ':collapse ::verb~(::builtin{:impl :tests/collapse/collapse})',
            impls: { collapse: () => { throw new QlangInvariantError('catalog bootstrap left no root module'); } }
          }
        : null)
    });

    const cellEntry = await sessionInstance.evalCell('use :tests/collapse | 42 | collapse');
    expect(cellEntry.result).toBeNull();
    expect(cellEntry.error).toBeInstanceOf(QlangInvariantError);
    expect(cellEntry.error.name).toBe('QlangInvariantError');
  });
});

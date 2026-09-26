// Tests for session.mjs — REPL/notebook session lifecycle.

import { describe, it, expect } from 'vitest';
import {
  createSession,
  serializeSession,
  deserializeSession
} from '../../src/session.mjs';
import { makeTagKeyword, isErrorValue, isQMap, TAG_HEADER_SYMBOL } from '../../src/types.mjs';
import { QlangTypeError, QlangInvariantError } from '../../src/errors.mjs';
import { nullaryOp, overloadedOp, stateOp, valueOp } from '../../src/runtime/dispatch.mjs';
import { withPipeValue } from '../../src/state.mjs';

describe('createSession lifecycle', () => {
  it('creates a session seeded with langRuntime builtins', async () => {
    const sessionInstance = await createSession();
    expect(sessionInstance.env).toBeInstanceOf(Map);
    expect(sessionInstance.env.has('count')).toBe(true);
    expect(sessionInstance.env.has('filter')).toBe(true);
  });

  it('evalCell returns an entry with result and updates history', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.result).toBe(42);
    expect(cellEntry.error).toBeNull();
    expect(sessionInstance.cellHistory).toHaveLength(1);
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
    await sessionInstance.evalCell('1');
    await sessionInstance.evalCell('2');
    expect(sessionInstance.cellHistory[0].uri).toBe('cell-1');
    expect(sessionInstance.cellHistory[1].uri).toBe('cell-2');
  });

  it('evalCell uri respects evalOpts.uri', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('1', { uri: 'notebook.qlang#cell-foo' });
    expect(cellEntry.uri).toBe('notebook.qlang#cell-foo');
  });

  it('takeSnapshot/restoreSnapshot round-trips env and history length', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':x 1');
    const snap = sessionInstance.takeSnapshot();
    await sessionInstance.evalCell(':y 2');
    expect(sessionInstance.cellHistory).toHaveLength(2);
    sessionInstance.restoreSnapshot(snap);
    expect(sessionInstance.cellHistory).toHaveLength(1);
    // x is still bound, y is gone
    expect((await sessionInstance.evalCell('x')).result).toBe(1);
    const yLookup = await sessionInstance.evalCell('y');
    // Unresolved identifier produces an error value.
    expect(isErrorValue(yLookup.result)).toBe(true);
  });

  it('bind installs a raw value into env', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('answer', 42);
    expect((await sessionInstance.evalCell('answer')).result).toBe(42);
  });
});

describe('serializeSession / deserializeSession round-trip', () => {
  it('preserves user BindStep verbs via their quotes', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':double ::verb~(mul 2)');
    await sessionInstance.evalCell(':triple ::verb~(mul 3)');

    const payload = await serializeSession(sessionInstance);
    const jsonText = JSON.stringify(payload);
    const restored = await deserializeSession(JSON.parse(jsonText));

    expect((await restored.evalCell('5 | double')).result).toBe(10);
    expect((await restored.evalCell('5 | triple')).result).toBe(15);
  });

  it('keeps a binding that shadows a verb of the core, and no key of the runtime', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':count 5');
    const payload = await serializeSession(sessionInstance);
    expect(payload.bindings.map(binding => binding.name)).toEqual(['count']);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));
    expect((await restored.evalCell('[1 2 3] | count')).result).toBe(5);
    expect((await restored.evalCell('[1 2 3] | vec/count')).result).toBe(3);
  });

  it('restored verbs honor lexical scope (immune to caller-side shadowing)', async () => {
    // A declared verb resolves in the scope its declaration wrote, so
    // a later cell that shadows `mul` does not affect the restored
    // verb's body resolution. deserializeSession gives every restored
    // verb the restored session's scope; a verb without one would
    // resolve where it runs and the shadow would leak into the body.
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':double ::verb~(mul 2)');
    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));
    // Shadow mul AFTER restore. Lexical scope means double's body
    // still resolves mul through the env captured at deserialize
    // time (the original builtin), not the call-site env carrying
    // the shadow.
    await restored.evalCell(':mul ::verb~(sub 1)');
    expect((await restored.evalCell('5 | double')).result).toBe(10);
  });

  it('preserves user freezes via tagged-JSON value replay', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | :answer /');
    await sessionInstance.evalCell('[1 2 3] | :nums /');

    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));

    expect((await restored.evalCell('answer')).result).toBe(42);
    expect((await restored.evalCell('nums | count')).result).toBe(3);
  });

  it('preserves the docs of a binding through the round trip', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':rate |~~ The tax rate. ~~| 0.07');

    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));

    expect((await restored.evalCell(':rate | docs | first | /content')).result).toBe(' The tax rate. ');
    expect((await restored.evalCell('rate')).result).toBe(0.07);
  });

  it('preserves cell history sources without re-running them', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':x 1');
    await sessionInstance.evalCell(':y 2');
    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(payload);
    expect(restored.cellHistory).toHaveLength(2);
    expect(restored.cellHistory[0].source).toBe(':x 1');
    expect(restored.cellHistory[1].source).toBe(':y 2');
  });

  it('does not serialize built-in functions', async () => {
    const sessionInstance = await createSession();
    const payload = await serializeSession(sessionInstance);
    expect(payload.bindings).toEqual([]);
  });

  it('rejects payload with wrong schemaVersion', async () => {
    let thrown;
    try { await deserializeSession({ schemaVersion: 999, bindings: [], cells: [] }); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionSchemaVersionMismatchError');
    expect(thrown.context.actual).toBe(999);
  });

  it('rejects payload with missing bindings array', async () => {
    let thrown;
    try { await deserializeSession({ schemaVersion: 3 }); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionPayloadInvalidError');
  });

  it('rejects null payload', async () => {
    let thrown;
    try { await deserializeSession(null); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionPayloadInvalidError');
  });

  it('serializes a raw value bound via session.bind as its value', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('answer', 42);
    const payload = await serializeSession(sessionInstance);
    const valueBinding = payload.bindings.find(b => b.name === 'answer');
    expect(valueBinding).toBeDefined();
    expect(valueBinding.value).toBe(42);
  });

  it('round-trips a raw value binding', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('answer', 42);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(await serializeSession(sessionInstance))));
    expect((await restored.evalCell('answer')).result).toBe(42);
  });

  it('skips user-installed function values during serialization', async () => {
    const sessionInstance = await createSession();
    // Inject a function value directly. serializeSession should
    // refuse to encode it but should not throw — it just omits.
    sessionInstance.bind('userFn', nullaryOp('userFn', (subject) => subject));
    const payload = await serializeSession(sessionInstance);
    expect(payload.bindings.find(b => b.name === 'userFn')).toBeUndefined();
  });

  it('runs a host operand overloaded by the count of its captured modifiers', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('pick', overloadedOp('pick', 2, {
      0: (subject) => subject,
      1: async (subject, pickLambda) => pickLambda(subject)
    }));
    expect((await sessionInstance.evalCell('7 | pick')).result).toBe(7);
    expect((await sessionInstance.evalCell('7 | pick (add 1)')).result).toBe(8);
  });

  it('runs a host operand of values against the subject or against two modifiers', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('less', valueOp('less', 2, (left, right) => left - right));
    expect((await sessionInstance.evalCell('7 | less 2')).result).toBe(5);
    expect((await sessionInstance.evalCell('7 | less 10 4')).result).toBe(6);
    expect((await sessionInstance.evalCell('7 | less !| type')).result).toEqual(makeTagKeyword('ValueOpArityMismatchError'));
  });

  it('runs a host operand over the state pair with its captured modifiers', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('twice', stateOp('twice', 2, async (state, lambdas) =>
      withPipeValue(state, (await lambdas[0](state.pipeValue)) * 2)));
    expect((await sessionInstance.evalCell('3 | twice (add 1)')).result).toBe(8);
    expect((await sessionInstance.evalCell('3 | twice !| type')).result).toEqual(makeTagKeyword('StateOpArityMismatchError'));
  });

  it('round-trips a user-defined tag-binding installed via ::tag ...', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(
      '::wrap {:impl ~(prepend "[" | append "]")}'
    );
    const restored = await deserializeSession(
      JSON.parse(JSON.stringify(await serializeSession(sessionInstance)))
    );
    const cellEntry = await restored.evalCell('"x" | ::wrap"x" | payload');
    expect(cellEntry.result).toBe('[x]');
  });
});

// ── Locator-based lazy module loading ─────────────────────────

// Minimal .qlang source for a module with one builtin descriptor
// and one qlang-only verb: a Map literal with the descriptor, merged
// via `use` to install it in env, then a verb that builds on it.
// The locator patches :impl on the builtin descriptor with the host
// function after eval. Env delta = the exports.
const MOCK_MODULE_SOURCE = [
  '{:@fetch ::builtin{:impl null',
  '                   :category :test-io',
  '                   :subject :string',
  '                   :modifiers []',
  '                   :returns :string',
  '                   :docs ["Fetches a resource by URL."]',
  '                   :examples []',
  '                   :throws []}}',
  '| use',
  '| :@doubled ::verb~(@fetch | append @fetch)'
].join('\n');

// Host-provided impl for the @fetch builtin — returns a fixed string.
const fetchImpl = nullaryOp('@fetch', () => 'fetched-value');

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

  it('the descriptor of a locator-loaded builtin carries captured and effectful', async () => {
    const locatorSession = await createSession({ locator: mockLocator });
    await locatorSession.evalCell('use :test/io');
    const specCell = await locatorSession.evalCell('::string/@fetch | spec');
    expect(specCell.error).toBeNull();
    const fetchDesc = specCell.result;
    expect(isQMap(fetchDesc)).toBe(true);
    expect(fetchDesc[TAG_HEADER_SYMBOL]).toEqual(makeTagKeyword('builtin'));
    expect(fetchDesc.get('captured')).toEqual([0, 0]);
    expect(fetchDesc.get('effectful')).toBe(true);
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

describe('session cells that carry more than a parse failure', () => {
  it('serializes a verb as its quote under its tag', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell(':scaled ::verb~(:factor ::number | mul factor)');

    const payload = await serializeSession(sessionInstance);
    const scaled = payload.bindings.find(b => b.name === 'scaled');
    expect(scaled.value).toEqual({ $tagged: { $tag: 'verb', payload: { $quote: ':factor ::number | mul factor' } } });

    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));
    expect((await restored.evalCell('5 | scaled 3')).result).toBe(15);
  });

  it('leaves an invariant failure on the error channel with no result value', async () => {
    // `evalAst` converts every failure into an ErrorValue except
    // QlangInvariantError, which travels as a host-level throw. The
    // cell records it on the error channel; only a ParseError also
    // lands a structured value on the result channel.
    const sessionInstance = await createSession();
    sessionInstance.bind('collapse', nullaryOp('collapse', () => {
      throw new QlangInvariantError('catalog bootstrap left no root module');
    }));

    const cellEntry = await sessionInstance.evalCell('42 | collapse');
    expect(cellEntry.result).toBeNull();
    expect(cellEntry.error).toBeInstanceOf(QlangInvariantError);
    expect(cellEntry.error.name).toBe('QlangInvariantError');
  });
});

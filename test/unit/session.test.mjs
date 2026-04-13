// Tests for session.mjs — REPL/notebook session lifecycle.

import { describe, it, expect } from 'vitest';
import {
  createSession,
  serializeSession,
  deserializeSession
} from '../../src/session.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

describe('createSession lifecycle', () => {
  it('creates a session seeded with langRuntime builtins', async () => {
    const sessionInstance = await createSession();
    expect(sessionInstance.env).toBeInstanceOf(Map);
    expect(sessionInstance.env.has(keyword('count'))).toBe(true);
    expect(sessionInstance.env.has(keyword('filter'))).toBe(true);
  });

  it('evalCell returns an entry with result and updates history', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('42');
    expect(cellEntry.result).toBe(42);
    expect(cellEntry.error).toBeNull();
    expect(sessionInstance.cellHistory).toHaveLength(1);
  });

  it('evalCell persists let bindings across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('let(:double, mul(2))');
    const cellEntry = await sessionInstance.evalCell('5 | double');
    expect(cellEntry.result).toBe(10);
  });

  it('evalCell persists as bindings across subsequent cells', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | as(:answer)');
    const cellEntry = await sessionInstance.evalCell('answer | mul(2)');
    expect(cellEntry.result).toBe(84);
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
    expect(cellEntry.result.originalError.name).toBe('CountSubjectNotContainer');
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
    await sessionInstance.evalCell('let(:x, 1)');
    const snap = sessionInstance.takeSnapshot();
    await sessionInstance.evalCell('let(:y, 2)');
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
  it('preserves user let bindings via conduit source replay', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('let(:double, mul(2))');
    await sessionInstance.evalCell('let(:triple, mul(3))');

    const payload = await serializeSession(sessionInstance);
    const jsonText = JSON.stringify(payload);
    const restored = await deserializeSession(JSON.parse(jsonText));

    expect((await restored.evalCell('5 | double')).result).toBe(10);
    expect((await restored.evalCell('5 | triple')).result).toBe(15);
  });

  it('restored conduits honor lexical scope (immune to caller-side shadowing)', async () => {
    // letOperand wires envRef.env to the env captured at declaration
    // time, so a later cell that shadows `mul` does not affect the
    // restored conduit's body resolution. deserializeSession must
    // perform the same wiring on every restored conduit; otherwise the
    // applyConduit fallback to state.env gives dynamic scope and the
    // shadow leaks into the body.
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('let(:double, mul(2))');
    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));
    // Shadow mul AFTER restore. Lexical scope means double's body
    // still resolves mul through the env captured at deserialize
    // time (the original builtin), not the call-site env carrying
    // the shadow.
    await restored.evalCell('let(:mul, sub(1))');
    expect((await restored.evalCell('5 | double')).result).toBe(10);
  });

  it('preserves user as snapshots via tagged-JSON value replay', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('42 | as(:answer)');
    await sessionInstance.evalCell('[1 2 3] | as(:nums)');

    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(JSON.parse(JSON.stringify(payload)));

    expect((await restored.evalCell('answer')).result).toBe(42);
    expect((await restored.evalCell('nums | count')).result).toBe(3);
  });

  it('preserves cell history sources without re-running them', async () => {
    const sessionInstance = await createSession();
    await sessionInstance.evalCell('let(:x, 1)');
    await sessionInstance.evalCell('let(:y, 2)');
    const payload = await serializeSession(sessionInstance);
    const restored = await deserializeSession(payload);
    expect(restored.cellHistory).toHaveLength(2);
    expect(restored.cellHistory[0].source).toBe('let(:x, 1)');
    expect(restored.cellHistory[1].source).toBe('let(:y, 2)');
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
    try { await deserializeSession({ schemaVersion: 1 }); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionPayloadInvalidError');
  });

  it('rejects conduit binding with no source', async () => {
    let thrown;
    try { await deserializeSession({ schemaVersion: 1, bindings: [{ kind: 'conduit', name: 'x', source: null, docs: [] }], cells: [] }); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionConduitSourceMissingError');
    expect(thrown.context.bindingName).toBe('x');
  });

  it('rejects unknown binding kind', async () => {
    let thrown;
    try { await deserializeSession({ schemaVersion: 1, bindings: [{ kind: 'something', name: 'x' }], cells: [] }); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionBindingKindUnknownError');
    expect(thrown.context.kind).toBe('something');
  });

  it('rejects null payload', async () => {
    let thrown;
    try { await deserializeSession(null); } catch (thrownErr) { thrown = thrownErr; }
    expect(thrown.name).toBe('SessionPayloadInvalidError');
  });

  it('serializes a raw value bound via session.bind as kind: value', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('answer', 42);
    const payload = await serializeSession(sessionInstance);
    const valueBinding = payload.bindings.find(b => b.name === 'answer');
    expect(valueBinding).toBeDefined();
    expect(valueBinding.kind).toBe('value');
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
    const fn = Object.freeze({
      type: 'function',
      name: 'userFn',
      arity: 1,
      fn: (state) => state,
      meta: { captured: [0, 0] }
    });
    sessionInstance.bind('userFn', fn);
    const payload = await serializeSession(sessionInstance);
    expect(payload.bindings.find(b => b.name === 'userFn')).toBeUndefined();
  });

  it('serializes a synthesized conduit (no .text on body) with source = null', async () => {
    // Construct a conduit whose expr is a hand-built AST node that
    // never came from the parser, so has no .text. The session
    // serializer must emit source: null without throwing.
    const { makeConduit } = await import('../../src/types.mjs');
    const synthAst = { type: 'NumberLit', value: 99 };
    const sessionInstance = await createSession();
    sessionInstance.bind('synth', makeConduit(synthAst, { name: 'synth' }));
    const payload = await serializeSession(sessionInstance);
    const synthBinding = payload.bindings.find(b => b.name === 'synth');
    expect(synthBinding.kind).toBe('conduit');
    expect(synthBinding.source).toBeNull();
  });
});

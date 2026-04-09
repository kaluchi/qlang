// Tests for session.mjs — REPL/notebook session lifecycle.

import { describe, it, expect } from 'vitest';
import {
  createSession,
  serializeSession,
  deserializeSession
} from '../../src/session.mjs';
import { keyword } from '../../src/types.mjs';

describe('createSession lifecycle', () => {
  it('creates a session seeded with langRuntime builtins', () => {
    const s = createSession();
    expect(s.env).toBeInstanceOf(Map);
    expect(s.env.has(keyword('count'))).toBe(true);
    expect(s.env.has(keyword('filter'))).toBe(true);
  });

  it('evalCell returns an entry with result and updates history', () => {
    const s = createSession();
    const entry = s.evalCell('42');
    expect(entry.result).toBe(42);
    expect(entry.error).toBeNull();
    expect(s.cellHistory).toHaveLength(1);
  });

  it('evalCell persists let bindings across subsequent cells', () => {
    const s = createSession();
    s.evalCell('let(:double, mul(2))');
    const entry = s.evalCell('5 | double');
    expect(entry.result).toBe(10);
  });

  it('evalCell persists as bindings across subsequent cells', () => {
    const s = createSession();
    s.evalCell('42 | as(:answer)');
    const entry = s.evalCell('answer | mul(2)');
    expect(entry.result).toBe(84);
  });

  it('evalCell records the error on parse failure', () => {
    const s = createSession();
    const entry = s.evalCell('[1 2');
    expect(entry.error).not.toBeNull();
    expect(entry.error.name).toBe('ParseError');
  });

  it('evalCell records the error on runtime failure', () => {
    const s = createSession();
    const entry = s.evalCell('42 | count');
    expect(entry.error).not.toBeNull();
    expect(entry.error.name).toBe('CountSubjectNotContainer');
  });

  it('evalCell uri defaults to cell-N', () => {
    const s = createSession();
    s.evalCell('1');
    s.evalCell('2');
    expect(s.cellHistory[0].uri).toBe('cell-1');
    expect(s.cellHistory[1].uri).toBe('cell-2');
  });

  it('evalCell uri respects evalOpts.uri', () => {
    const s = createSession();
    const entry = s.evalCell('1', { uri: 'notebook.qlang#cell-foo' });
    expect(entry.uri).toBe('notebook.qlang#cell-foo');
  });

  it('takeSnapshot/restoreSnapshot round-trips env and history length', () => {
    const s = createSession();
    s.evalCell('let(:x, 1)');
    const snap = s.takeSnapshot();
    s.evalCell('let(:y, 2)');
    expect(s.cellHistory).toHaveLength(2);
    s.restoreSnapshot(snap);
    expect(s.cellHistory).toHaveLength(1);
    // x is still bound, y is gone
    expect(s.evalCell('x').result).toBe(1);
    const yLookup = s.evalCell('y');
    expect(yLookup.error).not.toBeNull();
  });

  it('bind installs a raw value into env', () => {
    const s = createSession();
    s.bind('answer', 42);
    expect(s.evalCell('answer').result).toBe(42);
  });
});

describe('serializeSession / deserializeSession round-trip', () => {
  it('preserves user let bindings via thunk source replay', () => {
    const s = createSession();
    s.evalCell('let(:double, mul(2))');
    s.evalCell('let(:triple, mul(3))');

    const payload = serializeSession(s);
    const json = JSON.stringify(payload);
    const restored = deserializeSession(JSON.parse(json));

    expect(restored.evalCell('5 | double').result).toBe(10);
    expect(restored.evalCell('5 | triple').result).toBe(15);
  });

  it('preserves user as snapshots via tagged-JSON value replay', () => {
    const s = createSession();
    s.evalCell('42 | as(:answer)');
    s.evalCell('[1 2 3] | as(:nums)');

    const payload = serializeSession(s);
    const restored = deserializeSession(JSON.parse(JSON.stringify(payload)));

    expect(restored.evalCell('answer').result).toBe(42);
    expect(restored.evalCell('nums | count').result).toBe(3);
  });

  it('preserves cell history sources without re-running them', () => {
    const s = createSession();
    s.evalCell('let(:x, 1)');
    s.evalCell('let(:y, 2)');
    const payload = serializeSession(s);
    const restored = deserializeSession(payload);
    expect(restored.cellHistory).toHaveLength(2);
    expect(restored.cellHistory[0].source).toBe('let(:x, 1)');
    expect(restored.cellHistory[1].source).toBe('let(:y, 2)');
  });

  it('does not serialize built-in functions', () => {
    const s = createSession();
    const payload = serializeSession(s);
    expect(payload.bindings).toEqual([]);
  });

  it('rejects payload with wrong schemaVersion', () => {
    expect(() => deserializeSession({
      schemaVersion: 999,
      bindings: [],
      cells: []
    })).toThrow(/schemaVersion/);
  });

  it('rejects payload with missing bindings array', () => {
    expect(() => deserializeSession({ schemaVersion: 1 })).toThrow(/invalid/);
  });

  it('rejects conduit binding with no source', () => {
    expect(() => deserializeSession({
      schemaVersion: 1,
      bindings: [{ kind: 'conduit', name: 'x', source: null, docs: [] }],
      cells: []
    })).toThrow(/no source/);
  });

  it('rejects unknown binding kind', () => {
    expect(() => deserializeSession({
      schemaVersion: 1,
      bindings: [{ kind: 'something', name: 'x' }],
      cells: []
    })).toThrow(/unknown binding kind/);
  });

  it('rejects null payload', () => {
    expect(() => deserializeSession(null)).toThrow(/invalid/);
  });

  it('serializes a raw value bound via session.bind as kind: value', () => {
    const s = createSession();
    s.bind('answer', 42);
    const payload = serializeSession(s);
    const valueBinding = payload.bindings.find(b => b.name === 'answer');
    expect(valueBinding).toBeDefined();
    expect(valueBinding.kind).toBe('value');
    expect(valueBinding.value).toBe(42);
  });

  it('round-trips a raw value binding', () => {
    const s = createSession();
    s.bind('answer', 42);
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s))));
    expect(restored.evalCell('answer').result).toBe(42);
  });

  it('skips user-installed function values during serialization', () => {
    const s = createSession();
    // Inject a function value directly. serializeSession should
    // refuse to encode it but should not throw — it just omits.
    const fn = Object.freeze({
      type: 'function',
      name: 'userFn',
      arity: 1,
      fn: (state) => state,
      meta: { captured: [0, 0] }
    });
    s.bind('userFn', fn);
    const payload = serializeSession(s);
    expect(payload.bindings.find(b => b.name === 'userFn')).toBeUndefined();
  });

  it('serializes a synthesized thunk (no .text on body) with source = null', async () => {
    // Construct a thunk whose expr is a hand-built AST node that
    // never came from the parser, so has no .text. The session
    // serializer must emit source: null without throwing.
    const { makeConduit } = await import('../../src/types.mjs');
    const synthAst = { type: 'NumberLit', value: 99 };
    const s = createSession();
    s.bind('synth', makeConduit(synthAst, { name: 'synth' }));
    const payload = serializeSession(s);
    const synthBinding = payload.bindings.find(b => b.name === 'synth');
    expect(synthBinding.kind).toBe('conduit');
    expect(synthBinding.source).toBeNull();
  });
});

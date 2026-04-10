// Tests for use() overload (namespace import).

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

// ── use(:namespace) ─────────────────────────────────────────────

describe('use(:namespace) imports bindings', () => {
  it('imports all exports from a namespace Map', () => {
    const s = createSession();
    s.bind('myNs', new Map([[keyword('hello'), 42]]));
    const entry = s.evalCell('nil | use(:myNs) | hello');
    expect(entry.result).toBe(42);
  });
});

// ── use(Vec) ────────────────────────────────────────────────────

describe('use(Vec) imports in order', () => {
  it('imports from multiple namespaces in Vec order', () => {
    const s = createSession();
    s.bind('ns1', new Map([[keyword('a'), 1]]));
    s.bind('ns2', new Map([[keyword('b'), 2]]));
    const entry = s.evalCell('nil | use([:ns1 :ns2]) | [a b]');
    expect(entry.result).toEqual([1, 2]);
  });
});

// ── use(Set) collision ──────────────────────────────────────────

describe('use(Set) detects collision', () => {
  it('throws UseNamespaceCollision when two namespaces export the same name', () => {
    const s = createSession();
    s.bind('nsA', new Map([[keyword('x'), 1]]));
    s.bind('nsB', new Map([[keyword('x'), 2]]));
    const entry = s.evalCell('nil | use(#{:nsA :nsB}) | catch | /thrown');
    expect(entry.result).toEqual(keyword('UseNamespaceCollision'));
  });
});

// ── use(:ns, filter) selective ─────────────────────────────────

describe('use(:ns, filter) selective import', () => {
  it('imports only the selected export', () => {
    const s = createSession();
    s.bind('myNs', new Map([[keyword('foo'), 10], [keyword('bar'), 20]]));
    const entry = s.evalCell('nil | use(:myNs, [:foo]) | foo');
    expect(entry.result).toBe(10);
  });

  it('rejects missing export → UseNameNotExported', () => {
    const s = createSession();
    s.bind('myNs', new Map([[keyword('foo'), 10]]));
    const entry = s.evalCell('nil | use(:myNs, [:missing]) | catch | /thrown');
    expect(entry.result).toEqual(keyword('UseNameNotExported'));
  });
});

// ── use(:missing) ───────────────────────────────────────────────

describe('use(:missing) → UseNamespaceNotFound', () => {
  it('produces UseNamespaceNotFound when namespace not in env', () => {
    const s = createSession();
    const entry = s.evalCell('nil | use(:missing) | catch | /thrown');
    expect(entry.result).toEqual(keyword('UseNamespaceNotFound'));
  });
});

// ── use(:ns) where ns is not Map ────────────────────────────────

describe('use(:ns) where ns is not Map → UseNamespaceNotMap', () => {
  it('produces UseNamespaceNotMap when namespace bound to non-Map value', () => {
    const s = createSession();
    s.bind('notMap', 42);
    const entry = s.evalCell('nil | use(:notMap) | catch | /thrown');
    expect(entry.result).toEqual(keyword('UseNamespaceNotMap'));
  });
});

// ── use(non-keyword) ────────────────────────────────────────────

describe('use(non-keyword) → type-error', () => {
  it('produces UseNamespaceNotKeyword error for numeric argument', () => {
    const result = evalQuery('nil | use(42) | catch | /thrown');
    expect(result).toEqual(keyword('UseNamespaceNotKeyword'));
  });
});

// ── use Vec with non-keyword element ────────────────────────────

describe('use Vec with non-keyword element → UseNamespaceElementNotKeyword', () => {
  it('produces UseNamespaceElementNotKeyword for non-keyword in Vec', () => {
    const s = createSession();
    s.bind('ns1', new Map([[keyword('a'), 1]]));
    const entry = s.evalCell('nil | use([:ns1 42]) | catch | /thrown');
    expect(entry.result).toEqual(keyword('UseNamespaceElementNotKeyword'));
  });
});

describe('use Set without collision succeeds', () => {
  it('imports from Set when no collisions', () => {
    const s = createSession();
    s.bind('a', new Map([[keyword('x'), 10]]));
    s.bind('b', new Map([[keyword('y'), 20]]));
    const entry = s.evalCell('use(#{:a :b}) | add(x, y)');
    expect(entry.result).toBe(30);
  });
});

describe('use arity-2 with non-keyword namespace', () => {
  it('produces UseNamespaceNotKeyword', () => {
    const r = evalQuery('use(42, #{:x}) | catch | /thrown');
    expect(r.name).toBe('UseNamespaceNotKeyword');
  });
});

describe('use selective with Vec filter', () => {
  it('accepts Vec as selection filter', () => {
    const s = createSession();
    s.bind('lib', new Map([[keyword('x'), 10], [keyword('y'), 20]]));
    const entry = s.evalCell('use(:lib, [:x]) | x');
    expect(entry.result).toBe(10);
  });
});

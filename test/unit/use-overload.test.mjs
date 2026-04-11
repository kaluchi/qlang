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
    const entry = s.evalCell('nil | use(#{:nsA :nsB}) !| /thrown');
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
    const entry = s.evalCell('nil | use(:myNs, [:missing]) !| /thrown');
    expect(entry.result).toEqual(keyword('UseNameNotExported'));
  });
});

// ── use(:missing) ───────────────────────────────────────────────

describe('use(:missing) → UseNamespaceNotFound', () => {
  it('produces UseNamespaceNotFound when namespace not in env', () => {
    const s = createSession();
    const entry = s.evalCell('nil | use(:missing) !| /thrown');
    expect(entry.result).toEqual(keyword('UseNamespaceNotFound'));
  });
});

// ── use(:ns) where ns is not Map ────────────────────────────────

describe('use(:ns) where ns is not Map → UseNamespaceNotMap', () => {
  it('produces UseNamespaceNotMap when namespace bound to non-Map value', () => {
    const s = createSession();
    s.bind('notMap', 42);
    const entry = s.evalCell('nil | use(:notMap) !| /thrown');
    expect(entry.result).toEqual(keyword('UseNamespaceNotMap'));
  });
});

// ── use(non-keyword) ────────────────────────────────────────────

describe('use(non-keyword) → type-error', () => {
  it('produces UseNamespaceNotKeyword error for numeric argument', () => {
    const result = evalQuery('nil | use(42) !| /thrown');
    expect(result).toEqual(keyword('UseNamespaceNotKeyword'));
  });
});

// ── use Vec with non-keyword element ────────────────────────────

describe('use Vec with non-keyword element → UseNamespaceElementNotKeyword', () => {
  it('produces UseNamespaceElementNotKeyword for non-keyword in Vec', () => {
    const s = createSession();
    s.bind('ns1', new Map([[keyword('a'), 1]]));
    const entry = s.evalCell('nil | use([:ns1 42]) !| /thrown');
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
    const r = evalQuery('use(42, #{:x}) !| /thrown');
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

import { QlangError, QlangTypeError, ArityError } from '../../src/errors.mjs';

describe('per-site error triple-assertions', () => {
  it('UseNamespaceNotFound: name, instanceof, context', () => {
    const s = createSession();
    const r = s.evalCell('use(:nonexistent)');
    const e = r.result.originalError;
    expect(e.name).toBe('UseNamespaceNotFound');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.context.namespaceName).toBe('nonexistent');
  });

  it('UseNamespaceNotMap: name, instanceof, context', () => {
    const s = createSession();
    s.bind('notamap', 42);
    const r = s.evalCell('use(:notamap)');
    const e = r.result.originalError;
    expect(e.name).toBe('UseNamespaceNotMap');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.context.namespaceName).toBe('notamap');
    expect(e.context.actualType).toBe('number');
  });

  it('UseNamespaceCollision: name, instanceof, context', () => {
    const s = createSession();
    s.bind('a', new Map([[keyword('x'), 1]]));
    s.bind('b', new Map([[keyword('x'), 2]]));
    const r = s.evalCell('use(#{:a :b})');
    const e = r.result.originalError;
    expect(e.name).toBe('UseNamespaceCollision');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.context.collidingName).toBe('x');
  });

  it('UseNameNotExported: name, instanceof, context', () => {
    const s = createSession();
    s.bind('lib', new Map([[keyword('x'), 1]]));
    const r = s.evalCell('use(:lib, #{:z})');
    const e = r.result.originalError;
    expect(e.name).toBe('UseNameNotExported');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.context.namespaceName).toBe('lib');
    expect(e.context.exportName).toBe('z');
  });

  it('UseNamespaceElementNotKeyword: name, instanceof, context', () => {
    const s = createSession();
    s.bind('ns', new Map([[keyword('x'), 1]]));
    const r = s.evalCell('use([:ns 42])');
    const e = r.result.originalError;
    expect(e.name).toBe('UseNamespaceElementNotKeyword');
    expect(e).toBeInstanceOf(QlangTypeError);
  });

  it('UseNamespaceNotKeyword: name, instanceof, context', () => {
    const r = evalQuery('use(42, #{:x})');
    const e = r.originalError;
    expect(e.name).toBe('UseNamespaceNotKeyword');
    expect(e).toBeInstanceOf(QlangTypeError);
  });

  it('ErrorDescriptorNotMap: name, instanceof', () => {
    const r = evalQuery('42 | error');
    const e = r.originalError;
    expect(e.name).toBe('ErrorDescriptorNotMap');
    expect(e).toBeInstanceOf(QlangTypeError);
  });

  it('IsErrorNoCapturedArgs: name, instanceof, context', () => {
    const r = evalQuery('42 | isError(1)');
    const e = r.originalError;
    expect(e.name).toBe('IsErrorNoCapturedArgs');
    expect(e).toBeInstanceOf(ArityError);
    expect(e.context.actualCount).toBe(1);
  });
});

describe('higher-order lambda error propagation', () => {
  it('every propagates error from predicate', () => {
    const r = evalQuery('[1 2 3] | every(thisIsNotDefined) | isError');
    expect(r).toBe(true);
  });

  it('any propagates error from predicate', () => {
    const r = evalQuery('[1 2 3] | any(thisIsNotDefined) | isError');
    expect(r).toBe(true);
  });

  it('groupBy propagates error from key lambda', () => {
    const r = evalQuery('[1 2 3] | groupBy(thisIsNotDefined) | isError');
    expect(r).toBe(true);
  });

  it('indexBy propagates error from key lambda', () => {
    const r = evalQuery('[1 2 3] | indexBy(thisIsNotDefined) | isError');
    expect(r).toBe(true);
  });

  it('filter propagates error from predicate', () => {
    const r = evalQuery('[1 2 3] | filter(thisIsNotDefined) | isError');
    expect(r).toBe(true);
  });
});

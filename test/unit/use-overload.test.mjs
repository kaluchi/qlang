// Tests for use() overload (namespace import).

import { describe, it, expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { createSession } from '../../src/session.mjs';
import { keyword, isErrorValue } from '../../src/types.mjs';

// ── use(:namespace) ─────────────────────────────────────────────

describe('use(:namespace) imports bindings', () => {
  it('imports all exports from a namespace Map', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('myNs', new Map([[keyword('hello'), 42]]));
    const cellEntry = await sessionInstance.evalCell('null | use(:myNs) | hello');
    expect(cellEntry.result).toBe(42);
  });
});

// ── use(Vec) ────────────────────────────────────────────────────

describe('use(Vec) imports in order', () => {
  it('imports from multiple namespaces in Vec order', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('ns1', new Map([[keyword('a'), 1]]));
    sessionInstance.bind('ns2', new Map([[keyword('b'), 2]]));
    const cellEntry = await sessionInstance.evalCell('null | use([:ns1 :ns2]) | [a b]');
    expect(cellEntry.result).toEqual([1, 2]);
  });
});

// ── use(Set) collision ──────────────────────────────────────────

describe('use(Set) detects collision', () => {
  it('throws UseNamespaceCollision when two namespaces export the same name', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('nsA', new Map([[keyword('x'), 1]]));
    sessionInstance.bind('nsB', new Map([[keyword('x'), 2]]));
    const cellEntry = await sessionInstance.evalCell('null | use(#{:nsA :nsB}) !| /thrown');
    expect(cellEntry.result).toEqual(keyword('UseNamespaceCollision'));
  });
});

// ── use(:ns, filter) selective ─────────────────────────────────

describe('use(:ns, filter) selective import', () => {
  it('imports only the selected export', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('myNs', new Map([[keyword('foo'), 10], [keyword('bar'), 20]]));
    const cellEntry = await sessionInstance.evalCell('null | use(:myNs, [:foo]) | foo');
    expect(cellEntry.result).toBe(10);
  });

  it('rejects missing export → UseNameNotExported', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('myNs', new Map([[keyword('foo'), 10]]));
    const cellEntry = await sessionInstance.evalCell('null | use(:myNs, [:missing]) !| /thrown');
    expect(cellEntry.result).toEqual(keyword('UseNameNotExported'));
  });
});

// ── use(:missing) ───────────────────────────────────────────────

describe('use(:missing) → UseNamespaceNotFound', () => {
  it('produces UseNamespaceNotFound when namespace not in env', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('null | use(:missing) !| /thrown');
    expect(cellEntry.result).toEqual(keyword('UseNamespaceNotFound'));
  });
});

// ── use(:ns) where ns is not Map ────────────────────────────────

describe('use(:ns) where ns is not Map → UseNamespaceNotMap', () => {
  it('produces UseNamespaceNotMap when namespace bound to non-Map value', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('notMap', 42);
    const cellEntry = await sessionInstance.evalCell('null | use(:notMap) !| /thrown');
    expect(cellEntry.result).toEqual(keyword('UseNamespaceNotMap'));
  });
});

// ── use(non-keyword) ────────────────────────────────────────────

describe('use(non-keyword) → type-error', () => {
  it('produces UseNamespaceNotKeyword error for numeric argument', async () => {
    const evalResult = await evalQuery('null | use(42) !| /thrown');
    expect(evalResult).toEqual(keyword('UseNamespaceNotKeyword'));
  });
});

// ── use Vec with non-keyword element ────────────────────────────

describe('use Vec with non-keyword element → UseNamespaceElementNotKeyword', () => {
  it('produces UseNamespaceElementNotKeyword for non-keyword in Vec', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('ns1', new Map([[keyword('a'), 1]]));
    const cellEntry = await sessionInstance.evalCell('null | use([:ns1 42]) !| /thrown');
    expect(cellEntry.result).toEqual(keyword('UseNamespaceElementNotKeyword'));
  });
});

describe('use Set without collision succeeds', () => {
  it('imports from Set when no collisions', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('a', new Map([[keyword('x'), 10]]));
    sessionInstance.bind('b', new Map([[keyword('y'), 20]]));
    const cellEntry = await sessionInstance.evalCell('use(#{:a :b}) | add(x, y)');
    expect(cellEntry.result).toBe(30);
  });
});

describe('use arity-2 with non-keyword namespace', () => {
  it('produces UseNamespaceNotKeyword', async () => {
    const evalResult = await evalQuery('use(42, #{:x}) !| /thrown');
    expect(evalResult.name).toBe('UseNamespaceNotKeyword');
  });
});

describe('use selective with Vec filter', () => {
  it('accepts Vec as selection filter', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('lib', new Map([[keyword('x'), 10], [keyword('y'), 20]]));
    const cellEntry = await sessionInstance.evalCell('use(:lib, [:x]) | x');
    expect(cellEntry.result).toBe(10);
  });
});

import { QlangError, QlangTypeError, ArityError } from '../../src/errors.mjs';

describe('per-site error triple-assertions', () => {
  it('UseNamespaceNotFound: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    const cellEntry = await sessionInstance.evalCell('use(:nonexistent)');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseNamespaceNotFound');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.namespaceName).toBe('nonexistent');
  });

  it('UseNamespaceNotMap: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('notamap', 42);
    const cellEntry = await sessionInstance.evalCell('use(:notamap)');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseNamespaceNotMap');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.namespaceName).toBe('notamap');
    expect(originalErr.context.actualType).toBe('number');
  });

  it('UseNamespaceCollision: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('a', new Map([[keyword('x'), 1]]));
    sessionInstance.bind('b', new Map([[keyword('x'), 2]]));
    const cellEntry = await sessionInstance.evalCell('use(#{:a :b})');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseNamespaceCollision');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.collidingName).toBe('x');
  });

  it('UseNameNotExported: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('lib', new Map([[keyword('x'), 1]]));
    const cellEntry = await sessionInstance.evalCell('use(:lib, #{:z})');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseNameNotExported');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.context.namespaceName).toBe('lib');
    expect(originalErr.context.exportName).toBe('z');
  });

  it('UseNamespaceElementNotKeyword: name, instanceof, context', async () => {
    const sessionInstance = await createSession();
    sessionInstance.bind('ns', new Map([[keyword('x'), 1]]));
    const cellEntry = await sessionInstance.evalCell('use([:ns 42])');
    const originalErr = cellEntry.result.originalError;
    expect(originalErr.name).toBe('UseNamespaceElementNotKeyword');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
  });

  it('UseNamespaceNotKeyword: name, instanceof, context', async () => {
    const evalResult = await evalQuery('use(42, #{:x})');
    const originalErr = evalResult.originalError;
    expect(originalErr.name).toBe('UseNamespaceNotKeyword');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
  });

  it('ErrorDescriptorNotMap: name, instanceof', async () => {
    const evalResult = await evalQuery('42 | error');
    const originalErr = evalResult.originalError;
    expect(originalErr.name).toBe('ErrorDescriptorNotMap');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
  });

  it('NullaryOpArgsProvided on isError(1): name, instanceof, context', async () => {
    // isError is registered via nullaryOp; the dispatch-layer arity
    // error class is NullaryOpArgsProvided, shared by every nullary
    // operand that the caller incorrectly passes captured args to.
    const evalResult = await evalQuery('42 | isError(1)');
    const originalErr = evalResult.originalError;
    expect(originalErr.name).toBe('NullaryOpArgsProvided');
    expect(originalErr).toBeInstanceOf(ArityError);
    expect(originalErr.context.operandName).toBe('isError');
    expect(originalErr.context.actualArity).toBe(1);
  });
});

describe('higher-order lambda fail-track deflection into !|', () => {
  // When a lambda passed to a higher-order operand (every, any,
  // groupBy, indexBy, filter) raises an unresolved-identifier error,
  // the higher-order operand returns that error value as its own
  // result. Downstream the success-track `|` deflects the error, so
  // we route the next step through `!|` to fire on it and project
  // `:kind` out of the materialized descriptor.
  it('every returns the error raised by its predicate', async () => {
    const evalResult = await evalQuery('[1 2 3] | every(thisIsNotDefined) !| /kind');
    expect(evalResult).toEqual(keyword('unresolved-identifier'));
  });

  it('any returns the error raised by its predicate', async () => {
    const evalResult = await evalQuery('[1 2 3] | any(thisIsNotDefined) !| /kind');
    expect(evalResult).toEqual(keyword('unresolved-identifier'));
  });

  it('groupBy returns the error raised by its key lambda', async () => {
    const evalResult = await evalQuery('[1 2 3] | groupBy(thisIsNotDefined) !| /kind');
    expect(evalResult).toEqual(keyword('unresolved-identifier'));
  });

  it('indexBy returns the error raised by its key lambda', async () => {
    const evalResult = await evalQuery('[1 2 3] | indexBy(thisIsNotDefined) !| /kind');
    expect(evalResult).toEqual(keyword('unresolved-identifier'));
  });

  it('filter returns the error raised by its predicate', async () => {
    const evalResult = await evalQuery('[1 2 3] | filter(thisIsNotDefined) !| /kind');
    expect(evalResult).toEqual(keyword('unresolved-identifier'));
  });
});

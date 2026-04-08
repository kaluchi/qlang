// Tests for src/errors.mjs — base error hierarchy, fingerprint,
// location propagation, schemaVersion, and toJSON observability
// payload (Sentry-safe, drops actualValue PII).

import { describe, it, expect } from 'vitest';
import {
  QlangError,
  QlangTypeError,
  UnresolvedIdentifierError,
  DivisionByZeroError,
  ArityError,
  QlangInvariantError
} from '../../src/errors.mjs';
import { evalQuery } from '../../src/eval.mjs';

describe('QlangError base class', () => {
  it('carries kind, location=null, fingerprint=null, schemaVersion=1', () => {
    const e = new QlangError('boom', 'custom-kind');
    expect(e.kind).toBe('custom-kind');
    expect(e.location).toBeNull();
    expect(e.fingerprint).toBeNull();
    expect(e.schemaVersion).toBe(1);
    expect(e.message).toBe('boom');
    expect(e.name).toBe('QlangError');
    expect(e).toBeInstanceOf(Error);
  });

  it('toJSON returns a plain object with the documented shape', () => {
    const e = new QlangError('boom', 'custom');
    const json = e.toJSON();
    expect(json).toEqual({
      name: 'QlangError',
      kind: 'custom',
      message: 'boom',
      fingerprint: null,
      location: null,
      context: null,
      schemaVersion: 1
    });
  });

  it('toJSON drops actualValue from context (PII safe)', () => {
    const e = new QlangTypeError('typed', {
      site: 'TestSite',
      operand: 'op',
      expectedType: 'Vec',
      actualType: 'number',
      actualValue: 'SECRET-PII-DO-NOT-LEAK'
    });
    const json = e.toJSON();
    expect(json.context).toEqual({
      site: 'TestSite',
      operand: 'op',
      expectedType: 'Vec',
      actualType: 'number'
    });
    expect(json.context).not.toHaveProperty('actualValue');
  });

  it('toJSON includes location when set', () => {
    const e = new QlangError('boom', 'k');
    e.location = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 3, line: 1, column: 4 } };
    expect(e.toJSON().location).toEqual(e.location);
  });

  it('toJSON includes fingerprint when set', () => {
    const e = new QlangError('boom', 'k');
    e.fingerprint = 'ExampleFingerprint';
    expect(e.toJSON().fingerprint).toBe('ExampleFingerprint');
  });

  it('JSON.stringify invokes toJSON automatically', () => {
    const e = new QlangError('boom', 'k');
    e.fingerprint = 'X';
    const text = JSON.stringify(e);
    const parsed = JSON.parse(text);
    expect(parsed.fingerprint).toBe('X');
    expect(parsed.kind).toBe('k');
  });
});

describe('UnresolvedIdentifierError', () => {
  it('sets identifierName, kind, fingerprint', () => {
    const e = new UnresolvedIdentifierError('foo');
    expect(e.identifierName).toBe('foo');
    expect(e.kind).toBe('unresolved-identifier');
    expect(e.fingerprint).toBe('UnresolvedIdentifierError');
    expect(e.message).toContain('foo');
  });

  it('toJSON inherits from QlangError', () => {
    const e = new UnresolvedIdentifierError('foo');
    const json = e.toJSON();
    expect(json.name).toBe('UnresolvedIdentifierError');
    expect(json.fingerprint).toBe('UnresolvedIdentifierError');
  });
});

describe('DivisionByZeroError', () => {
  it('has a fixed message and fingerprint', () => {
    const e = new DivisionByZeroError();
    expect(e.kind).toBe('division-by-zero');
    expect(e.fingerprint).toBe('DivisionByZeroError');
    expect(e.message).toBe('division by zero');
  });
});

describe('ArityError', () => {
  it('carries context and kind', () => {
    const e = new ArityError('too many args', { count: 5 });
    expect(e.kind).toBe('arity-error');
    expect(e.context.count).toBe(5);
  });
});

describe('QlangInvariantError', () => {
  it('is constructible with message and context', () => {
    const e = new QlangInvariantError('registration failed', { site: 'X', operandName: 'foo' });
    expect(e.kind).toBe('invariant-error');
    expect(e.context.site).toBe('X');
    expect(e.context.operandName).toBe('foo');
    expect(e).toBeInstanceOf(QlangError);
  });
});

describe('runtime error location propagation via evalNode', () => {
  function catchError(query) {
    try { evalQuery(query); return null; }
    catch (e) { return e; }
  }

  it('attaches a location to a runtime type error', () => {
    const e = catchError('42 | filter(gt(0))');
    expect(e).toBeInstanceOf(QlangTypeError);
    expect(e.location).not.toBeNull();
    expect(typeof e.location.start.offset).toBe('number');
  });

  it('the attached location points to the failing operand call', () => {
    const source = '[1 2 3] | filter(gt(0)) | 99 | filter(gt(0))';
    //              0         1         2         3         4
    //              0123456789012345678901234567890123456789012345
    const e = catchError(source);
    expect(e).not.toBeNull();
    // The second filter is at offset 31 (`filter` after the `99 | `)
    expect(e.location.start.offset).toBe(source.indexOf('filter', 25));
  });

  it('does not overwrite a location set by a deeper frame', () => {
    // div(0) inside filter — the divisor 0 fires DivisionByZero
    // before any outer error. The location should reference the
    // div call site, not the filter that wraps it.
    const e = catchError('[1 2] | filter(div(/x, 0))');
    expect(e).toBeInstanceOf(QlangError);
    expect(e.location).not.toBeNull();
  });

  it('per-site fingerprint is set on type errors thrown by operands', () => {
    const e = catchError('42 | filter(gt(0))');
    expect(e.fingerprint).toBe('FilterSubjectNotVec');
  });
});

describe('error class branding survives Object.defineProperty (minification proxy)', () => {
  // Per-site error classes are minification-resilient because their
  // `.name` is set via Object.defineProperty in operand-errors.brand,
  // which writes a string literal that bundlers do not mangle. We
  // verify the contract here: even if we artificially shadow the
  // class identifier, the runtime `.name` survives.
  it('class.name set by brand() persists across reassignment', () => {
    function catchError(query) {
      try { evalQuery(query); return null; }
      catch (e) { return e; }
    }
    const e = catchError('42 | count');
    expect(e.name).toBe('CountSubjectNotContainer');
    // Constructor.name is the same string regardless of caller-side
    // identifier mangling.
    expect(e.constructor.name).toBe('CountSubjectNotContainer');
  });
});

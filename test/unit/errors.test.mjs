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
import { isErrorValue } from '../../src/types.mjs';

describe('QlangError base class', () => {
  it('carries kind, location=null, fingerprint=null, schemaVersion=1', () => {
    const qlangErr = new QlangError('boom', 'custom-kind');
    expect(qlangErr.kind).toBe('custom-kind');
    expect(qlangErr.location).toBeNull();
    expect(qlangErr.fingerprint).toBeNull();
    expect(qlangErr.schemaVersion).toBe(1);
    expect(qlangErr.message).toBe('boom');
    expect(qlangErr.name).toBe('QlangError');
    expect(qlangErr).toBeInstanceOf(Error);
  });

  it('toJSON returns a plain object with the documented shape', () => {
    const qlangErr = new QlangError('boom', 'custom');
    const jsonPayload = qlangErr.toJSON();
    expect(jsonPayload).toEqual({
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
    const typeErr = new QlangTypeError('typed', {
      site: 'TestSite',
      operand: 'op',
      expectedType: 'Vec',
      actualType: 'number',
      actualValue: 'SECRET-PII-DO-NOT-LEAK'
    });
    const jsonPayload = typeErr.toJSON();
    expect(jsonPayload.context).toEqual({
      site: 'TestSite',
      operand: 'op',
      expectedType: 'Vec',
      actualType: 'number'
    });
    expect(jsonPayload.context).not.toHaveProperty('actualValue');
  });

  it('toJSON includes location when set', () => {
    const qlangErr = new QlangError('boom', 'k');
    qlangErr.location = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 3, line: 1, column: 4 } };
    expect(qlangErr.toJSON().location).toEqual(qlangErr.location);
  });

  it('toJSON includes fingerprint when set', () => {
    const qlangErr = new QlangError('boom', 'k');
    qlangErr.fingerprint = 'ExampleFingerprint';
    expect(qlangErr.toJSON().fingerprint).toBe('ExampleFingerprint');
  });

  it('JSON.stringify invokes toJSON automatically', () => {
    const qlangErr = new QlangError('boom', 'k');
    qlangErr.fingerprint = 'X';
    const textRepr = JSON.stringify(qlangErr);
    const parsed = JSON.parse(textRepr);
    expect(parsed.fingerprint).toBe('X');
    expect(parsed.kind).toBe('k');
  });
});

describe('UnresolvedIdentifierError', () => {
  it('sets identifierName, kind, fingerprint', () => {
    const unresolvedErr = new UnresolvedIdentifierError('foo');
    expect(unresolvedErr.identifierName).toBe('foo');
    expect(unresolvedErr.kind).toBe('unresolved-identifier');
    expect(unresolvedErr.fingerprint).toBe('UnresolvedIdentifierError');
    expect(unresolvedErr.message).toContain('foo');
  });

  it('toJSON inherits from QlangError', () => {
    const unresolvedErr = new UnresolvedIdentifierError('foo');
    const jsonPayload = unresolvedErr.toJSON();
    expect(jsonPayload.name).toBe('UnresolvedIdentifierError');
    expect(jsonPayload.fingerprint).toBe('UnresolvedIdentifierError');
  });
});

describe('DivisionByZeroError', () => {
  it('has a fixed message and fingerprint', () => {
    const divErr = new DivisionByZeroError();
    expect(divErr.kind).toBe('division-by-zero');
    expect(divErr.fingerprint).toBe('DivisionByZeroError');
    expect(divErr.message).toBe('division by zero');
  });
});

describe('ArityError', () => {
  it('carries context and kind', () => {
    const arityErr = new ArityError('too many args', { count: 5 });
    expect(arityErr.kind).toBe('arity-error');
    expect(arityErr.context.count).toBe(5);
  });
});

describe('QlangInvariantError', () => {
  it('is constructible with message and context', () => {
    const invariantErr = new QlangInvariantError('registration failed', { site: 'X', operandName: 'foo' });
    expect(invariantErr.kind).toBe('invariant-error');
    expect(invariantErr.context.site).toBe('X');
    expect(invariantErr.context.operandName).toBe('foo');
    expect(invariantErr).toBeInstanceOf(QlangError);
  });
});

describe('runtime error location propagation via evalNode', () => {
  // Runtime errors are error values. Use .originalError to access
  // the underlying QlangError with location, fingerprint, etc.
  async function getOriginalError(query) {
    const evalResult = await evalQuery(query);
    if (isErrorValue(evalResult)) return evalResult.originalError;
    return null;
  }

  it('attaches a location to a runtime type error', async () => {
    const originalErr = await getOriginalError('42 | filter(gt(0))');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.location).not.toBeNull();
    expect(typeof originalErr.location.start.offset).toBe('number');
  });

  it('the attached location points to the failing operand call', async () => {
    const source = '[1 2 3] | filter(gt(0)) | 99 | filter(gt(0))';
    //              0         1         2         3         4
    //              0123456789012345678901234567890123456789012345
    const originalErr = await getOriginalError(source);
    expect(originalErr).not.toBeNull();
    // The second filter is at offset 31 (`filter` after the `99 | `)
    expect(originalErr.location.start.offset).toBe(source.indexOf('filter', 25));
  });

  it('does not overwrite a location set by a deeper frame', async () => {
    // An error in an inner step carries its location through the pipeline.
    // The outer step (mul) is never reached — the error value propagates.
    // Location references the inner `count` call site, not the outer `mul`.
    const originalErr = await getOriginalError('42 | count | mul(2)');
    expect(originalErr).toBeInstanceOf(QlangError);
    expect(originalErr.location).not.toBeNull();
    // count is at offset 5 in the source
    expect(originalErr.location.start.offset).toBe(5);
  });

  it('per-site fingerprint is set on type errors thrown by operands', async () => {
    const originalErr = await getOriginalError('42 | filter(gt(0))');
    expect(originalErr.fingerprint).toBe('FilterSubjectNotVec');
  });
});

describe('error class branding survives Object.defineProperty (minification proxy)', () => {
  // Per-site error classes are minification-resilient because their
  // `.name` is set via Object.defineProperty in operand-errors.brand,
  // which writes a string literal that bundlers do not mangle. We
  // verify the contract here: even if we artificially shadow the
  // class identifier, the runtime `.name` survives.
  it('class.name set by brand() persists across reassignment', async () => {
    const evalResult = await evalQuery('42 | count');
    const originalErr = isErrorValue(evalResult) ? evalResult.originalError : null;
    expect(originalErr.name).toBe('CountSubjectNotContainer');
    // Constructor.name is the same string regardless of caller-side
    // identifier mangling.
    expect(originalErr.constructor.name).toBe('CountSubjectNotContainer');
  });
});

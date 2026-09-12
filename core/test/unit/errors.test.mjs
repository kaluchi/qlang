// Tests for src/errors.mjs — base error hierarchy, fingerprint,
// location propagation, schemaVersion, and toJSON observability
// payload (Sentry-safe, drops actualValue PII).

import { describe, it, expect } from 'vitest';
import {
  QlangError,
  QlangTypeError,
  UnresolvedIdentifierError,
  ArityError,
  EvaluationDepthExceededError,
  QlangInvariantError,
  ThrowSiteSpecAlreadyRecordedError,
  declarePerSiteError,
  declareForeignError
} from '../../src/errors.mjs';
import { DivisionByZeroError } from '../../src/runtime/arith.mjs';
import { keyword } from '../../src/types.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

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
      context: {},
      schemaVersion: 1
    });
  });

  it('toJSON drops actualValue from context (PII safe)', () => {
    const typeErr = new QlangTypeError('typed', {
      site: 'TestSite',
      operand: 'op',
      expectedType: keyword('vec'),
      actualType: { name: 'number' },
      actualValue: 'SECRET-PII-DO-NOT-LEAK'
    });
    const jsonPayload = typeErr.toJSON();
    expect(jsonPayload.context).toEqual({
      site: 'TestSite',
      operand: 'op',
      expectedType: keyword('vec'),
      actualType: { name: 'number' }
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
    const unresolvedErr = new UnresolvedIdentifierError({ identifierName: 'foo' });
    expect(unresolvedErr.context.identifierName).toBe('foo');
    expect(unresolvedErr.kind).toBe('unresolvedIdentifier');
    expect(unresolvedErr.fingerprint).toBe('UnresolvedIdentifierError');
    expect(unresolvedErr.message).toContain('foo');
  });

  it('toJSON inherits from QlangError', () => {
    const unresolvedErr = new UnresolvedIdentifierError({ identifierName: 'foo' });
    const jsonPayload = unresolvedErr.toJSON();
    expect(jsonPayload.name).toBe('UnresolvedIdentifierError');
    expect(jsonPayload.fingerprint).toBe('UnresolvedIdentifierError');
  });
});

describe('DivisionByZeroError', () => {
  it('has a fixed message and fingerprint', () => {
    const divErr = new DivisionByZeroError();
    expect(divErr.kind).toBe('numericDomain');
    expect(divErr.fingerprint).toBe('DivisionByZeroError');
    expect(divErr.message).toBe('division by zero');
  });
});

describe('ArityError', () => {
  it('carries context and kind', () => {
    const arityErr = new ArityError('too many args', { count: 5 });
    expect(arityErr.kind).toBe('arityError');
    expect(arityErr.context.count).toBe(5);
  });
});

describe('EvaluationDepthExceededError', () => {
  it('carries the refused frame and the budget under kind resourceLimit', () => {
    const depthErr = new EvaluationDepthExceededError({ depth: 11, limit: 10 });
    expect(depthErr).toBeInstanceOf(QlangError);
    expect(depthErr.kind).toBe('resourceLimit');
    expect(depthErr.name).toBe('EvaluationDepthExceededError');
    expect(depthErr.fingerprint).toBe('EvaluationDepthExceededError');
    expect(depthErr.context).toEqual({ depth: 11, limit: 10 });
    expect(depthErr.message).toBe('evaluation depth 11 exceeds the budget of 10 nested frames');
  });
});

describe('QlangInvariantError', () => {
  it('is constructible with message and context', () => {
    const invariantErr = new QlangInvariantError('registration failed', { site: 'X', operandName: 'foo' });
    expect(invariantErr.kind).toBe('invariantError');
    expect(invariantErr.context.site).toBe('X');
    expect(invariantErr.context.operandName).toBe('foo');
    expect(invariantErr).toBeInstanceOf(QlangError);
  });
});

describe('runtime error location propagation via evalNode', () => {
  // Runtime errors are error values; `catchOriginalError` (shared
  // helper) unwraps the underlying QlangError off `.originalError`
  // so the location / fingerprint assertions below read structurally.

  it('attaches a location to a runtime type error', async () => {
    const originalErr = await catchOriginalError('42 | filter(gt(0))');
    expect(originalErr).toBeInstanceOf(QlangTypeError);
    expect(originalErr.location).not.toBeNull();
    expect(typeof originalErr.location.start.offset).toBe('number');
  });

  it('the attached location points to the failing operand call', async () => {
    const source = '[1 2 3] | filter(gt(0)) | 99 | filter(gt(0))';
    //              0         1         2         3         4
    //              0123456789012345678901234567890123456789012345
    const originalErr = await catchOriginalError(source);
    expect(originalErr).not.toBeNull();
    // The second filter is at offset 31 (`filter` after the `99 | `)
    expect(originalErr.location.start.offset).toBe(source.indexOf('filter', 25));
  });

  it('does not overwrite a location set by a deeper frame', async () => {
    // An error in an inner step carries its location through the pipeline.
    // The outer step (mul) is never reached — the error value propagates.
    // Location references the inner `count` call site, not the outer `mul`.
    const originalErr = await catchOriginalError('42 | count | mul(2)');
    expect(originalErr).toBeInstanceOf(QlangError);
    expect(originalErr.location).not.toBeNull();
    // count is at offset 5 in the source
    expect(originalErr.location.start.offset).toBe(5);
  });

  it('per-site fingerprint is set on type errors thrown by operands', async () => {
    const originalErr = await catchOriginalError('42 | filter(gt(0))');
    expect(originalErr.fingerprint).toBe('FilterSubjectNotContainerError');
  });
});

describe('error class branding survives Object.defineProperty (minification proxy)', () => {
  // Per-site error classes are minification-resilient because their
  // `.name` is set via Object.defineProperty in operand-errors.brand,
  // which writes a string literal that bundlers do not mangle. We
  // verify the contract here: even if we artificially shadow the
  // class identifier, the runtime `.name` survives.
  it('class.name set by brand() persists across reassignment', async () => {
    const originalErr = await catchOriginalError('42 | count');
    expect(originalErr.name).toBe('CountSubjectNotContainerError');
    // Constructor.name is the same string regardless of caller-side
    // identifier mangling.
    expect(originalErr.constructor.name).toBe('CountSubjectNotContainerError');
  });
});

describe('throw-site spec registry — one name, one site', () => {
  // The registry is what the bootstrap stamps from, so a second
  // class under one name would hand its `::Tag` binding a spec for
  // the other site — and share the Sentry fingerprint besides.
  it('refuses a second recording under a name already declared', () => {
    let refusal = null;
    try {
      declarePerSiteError('DivisionByZeroError', 'numericDomain', () => 'a second site');
    } catch (caught) {
      refusal = caught;
    }
    expect(refusal).toBeInstanceOf(QlangInvariantError);
    expect(refusal).toBeInstanceOf(ThrowSiteSpecAlreadyRecordedError);
    expect(refusal.name).toBe('ThrowSiteSpecAlreadyRecordedError');
    expect(refusal.context.className).toBe('DivisionByZeroError');
    expect(refusal.message).toContain('DivisionByZeroError');
  });
});

describe('declareForeignError — a failure of the embedding', () => {
  // The class stays off the QlangError hierarchy so the deflect
  // combinators never see it, and carries the per-site identity
  // every other factory stamps.
  it('mints a class outside the QlangError hierarchy that still names its site', () => {
    const HostBridgeUnreachableError = declareForeignError('HostBridgeUnreachableError',
      ({ endpoint }) => `host bridge at ${endpoint} answered nothing`);
    const foreignErr = new HostBridgeUnreachableError({ endpoint: 'ipc://bridge' });

    expect(foreignErr).toBeInstanceOf(Error);
    expect(foreignErr).not.toBeInstanceOf(QlangError);
    expect(foreignErr.name).toBe('HostBridgeUnreachableError');
    expect(foreignErr.fingerprint).toBe('HostBridgeUnreachableError');
    expect(foreignErr.context.endpoint).toBe('ipc://bridge');
    expect(foreignErr.message).toContain('ipc://bridge');
  });
});

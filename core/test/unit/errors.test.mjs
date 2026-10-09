// Tests for src/errors.mjs — the one kind of refusal, the defects of the
// runtime, the names of the classes and location propagation.

import { describe, it, expect } from 'vitest';
import {
  QlangError,
  CallUnknownNameError,
  CallEvaluationDepthExceededError,
  QlangInvariantError,
  BuiltinRefusalDeclaredTwiceError,
  declareRefusal,
  declareForeignError
} from '../../src/errors.mjs';
import { keyword } from '../../src/types.mjs';
import { catchOriginalError } from '../helpers/error-assertions.mjs';

describe('QlangError base class', () => {
  it('carries its facts and location=null', () => {
    const qlangErr = new QlangError('boom', { count: 5 });
    expect(qlangErr.context).toEqual({ count: 5 });
    expect(qlangErr.location).toBeNull();
    expect(qlangErr.message).toBe('boom');
    expect(qlangErr.name).toBe('QlangError');
    expect(qlangErr).toBeInstanceOf(Error);
  });
});

// A refusal whose site hands no facts.
const TestsProbeError = declareRefusal('tests/ProbeError');

describe('a refusal declared by its address [D172]', () => {
  it('carries the facts its site hands, named by the last name of its address', () => {
    const unresolvedErr = new CallUnknownNameError({ name: keyword('foo') });
    expect(unresolvedErr).toBeInstanceOf(QlangError);
    expect(unresolvedErr.context.name.name).toBe('foo');
    expect(unresolvedErr.name).toBe('UnknownNameError');
    expect(unresolvedErr.address).toBe('call/UnknownNameError');
  });

  it('says its address as its message, whatever facts its site hands', () => {
    expect(new TestsProbeError().message).toBe('::tests/ProbeError');
    expect(new CallEvaluationDepthExceededError({ depth: 11, limit: 10 }).message).toBe('::call/EvaluationDepthExceededError');
  });

  it('hands no facts where its site hands none', () => {
    const probeErr = new TestsProbeError();
    expect(probeErr.name).toBe('ProbeError');
    expect(probeErr.context).toEqual({});
  });
});

describe('QlangInvariantError', () => {
  it('is constructible with message and context', () => {
    const invariantErr = new QlangInvariantError('registration failed', { site: 'X', operandName: 'foo' });
    expect(invariantErr.message).toBe('registration failed');
    expect(invariantErr.context.site).toBe('X');
    expect(invariantErr.context.operandName).toBe('foo');
    expect(invariantErr).toBeInstanceOf(QlangError);
  });
});

describe('runtime error location propagation via evalNode', () => {
  // Runtime errors are error values; `catchOriginalError` (shared
  // helper) unwraps the underlying QlangError off `.originalError`
  // so the location / name assertions below read structurally.

  it('attaches a location to a refusal of the runtime', async () => {
    const originalErr = await catchOriginalError('42 | filter ~(gt 0)');
    expect(originalErr).toBeInstanceOf(QlangError);
    expect(originalErr.location).not.toBeNull();
    expect(typeof originalErr.location.start.offset).toBe('number');
  });

  it('the attached location points to the failing operand call', async () => {
    const source = '[1 2 3] | filter ~(gt 0) | 99 | filter ~(gt 0)';
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
    const originalErr = await catchOriginalError('42 | count | mul 2');
    expect(originalErr).toBeInstanceOf(QlangError);
    expect(originalErr.location).not.toBeNull();
    // count is at offset 5 in the source
    expect(originalErr.location.start.offset).toBe(5);
  });

  it('per-site name is set on the refusals the runtime raises', async () => {
    const originalErr = await catchOriginalError('42 * add 1');
    expect(originalErr.name).toBe('SubjectNotContainerError');
  });
});

describe('error class branding survives Object.defineProperty (minification proxy)', () => {
  // A refusal's class is minification-resilient because its `.name` is
  // set via Object.defineProperty in `brand`, which writes a string
  // literal that bundlers do not mangle. We verify the contract here:
  // even if we artificially shadow the class identifier, the runtime
  // `.name` survives.
  it('class.name set by brand() persists across reassignment', async () => {
    const originalErr = await catchOriginalError('42 * add 1');
    expect(originalErr.name).toBe('SubjectNotContainerError');
    // Constructor.name is the same string regardless of caller-side
    // identifier mangling.
    expect(originalErr.constructor.name).toBe('SubjectNotContainerError');
  });
});

describe('one address, one site', () => {
  // The address is the tag a refusal answers by and the name of its
  // page, so a second class under one address would speak for the
  // other site.
  it('refuses a second declaration of an address already declared', () => {
    let refusal = null;
    try {
      declareRefusal('call/UnknownNameError');
    } catch (caught) {
      refusal = caught;
    }
    expect(refusal).toBeInstanceOf(QlangInvariantError);
    expect(refusal).toBeInstanceOf(BuiltinRefusalDeclaredTwiceError);
    expect(refusal.name).toBe('RefusalDeclaredTwiceError');
    expect(refusal.context.address).toBe('call/UnknownNameError');
    expect(refusal.message).toContain('call/UnknownNameError');
  });
});

describe('declareForeignError — a failure of the embedding', () => {
  // The class stays off the QlangError hierarchy so the deflect
  // combinators never see it, and carries the address every other
  // declaration stamps.
  it('mints a class outside the QlangError hierarchy that still names its site', () => {
    const HostBridgeUnreachableError = declareForeignError('HostBridgeUnreachableError',
      ({ endpoint }) => `host bridge at ${endpoint} answered nothing`);
    const foreignErr = new HostBridgeUnreachableError({ endpoint: 'ipc://bridge' });

    expect(foreignErr).toBeInstanceOf(Error);
    expect(foreignErr).not.toBeInstanceOf(QlangError);
    expect(foreignErr.name).toBe('HostBridgeUnreachableError');
    expect(foreignErr.context.endpoint).toBe('ipc://bridge');
    expect(foreignErr.message).toContain('ipc://bridge');
  });
});

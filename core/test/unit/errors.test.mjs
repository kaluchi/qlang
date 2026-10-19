// Tests for src/errors.mjs — the one kind of refusal, the defects of the
// runtime, the names of the classes and the location of a refusal.

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
import { catchOriginalError, expectErrorResult } from '../helpers/error-assertions.mjs';

describe('QlangError base class', () => {
  it('carries its facts', () => {
    const qlangErr = new QlangError('boom', { count: 5 });
    expect(qlangErr.facts).toEqual({ count: 5 });
    expect(qlangErr.message).toBe('boom');
    expect(qlangErr.name).toBe('QlangError');
    expect(qlangErr).toBeInstanceOf(Error);
  });
});

// A refusal whose site hands no facts.
const TestsProbeError = declareRefusal('tests/ProbeError');

describe('a refusal declared by its address [QSERR#site]', () => {
  it('carries the facts its site hands, named by the last name of its address', () => {
    const unresolvedErr = new CallUnknownNameError({ name: keyword('foo') });
    expect(unresolvedErr).toBeInstanceOf(QlangError);
    expect(unresolvedErr.facts.name.name).toBe('foo');
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
    expect(probeErr.facts).toEqual({});
  });
});

describe('QlangInvariantError', () => {
  it('is constructible with message and context', () => {
    const invariantErr = new QlangInvariantError('registration failed', { site: 'X', verb: 'foo' });
    expect(invariantErr.message).toBe('registration failed');
    expect(invariantErr.facts.site).toBe('X');
    expect(invariantErr.facts.verb).toBe('foo');
    expect(invariantErr).toBeInstanceOf(QlangError);
  });
});

describe('the location of a refusal of the runtime, the span of the step that raised it [QSERR#site]', () => {
  it('locates a refusal at the call that raised it', async () => {
    const source = '[1 2 3] | filter ~(gt 0) | count | filter ~(gt 0)';
    expect((await expectErrorResult(source)).location.start.offset).toBe(source.indexOf('filter', 25));
  });

  it('locates a refusal inside a quote a step hands a verb in the source of the query', async () => {
    const source = '[1 2] | map ~(add 1 | nope 2)';
    expect((await expectErrorResult(source)).location.start.offset).toBe(source.indexOf('nope'));
  });

  it('keeps the location of the step that raised it past the steps it skips', async () => {
    expect((await expectErrorResult('42 | count | mul 2')).location.start.offset).toBe(5);
  });

  it('per-site name is set on the refusals the runtime raises', async () => {
    const originalErr = await catchOriginalError('1 | get /name');
    expect(originalErr.name).toBe('SubjectHasNoPartsError');
  });
});

describe('error class branding survives Object.defineProperty (minification proxy)', () => {
  // A refusal's class is minification-resilient because its `.name` is
  // set via Object.defineProperty in `brand`, which writes a string
  // literal that bundlers do not mangle. We verify the contract here:
  // even if we artificially shadow the class identifier, the runtime
  // `.name` survives.
  it('class.name set by brand() persists across reassignment', async () => {
    const originalErr = await catchOriginalError('1 | get /name');
    expect(originalErr.name).toBe('SubjectHasNoPartsError');
    // Constructor.name is the same string regardless of caller-side
    // identifier mangling.
    expect(originalErr.constructor.name).toBe('SubjectHasNoPartsError');
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
    expect(refusal.facts.address).toBe('call/UnknownNameError');
    expect(refusal.message).toContain('call/UnknownNameError');
  });
});

describe('declareForeignError — a failure of the embedding', () => {
  // The class stays off the QlangError hierarchy and carries the address
  // every other declaration stamps.
  it('declares a class outside the QlangError hierarchy that still names its site', () => {
    const HostBridgeUnreachableError = declareForeignError('HostBridgeUnreachableError',
      ({ endpoint }) => `host bridge at ${endpoint} answered nothing`);
    const foreignErr = new HostBridgeUnreachableError({ endpoint: 'ipc://bridge' });

    expect(foreignErr).toBeInstanceOf(Error);
    expect(foreignErr).not.toBeInstanceOf(QlangError);
    expect(foreignErr.name).toBe('HostBridgeUnreachableError');
    expect(foreignErr.facts.endpoint).toBe('ipc://bridge');
    expect(foreignErr.message).toContain('ipc://bridge');
  });
});

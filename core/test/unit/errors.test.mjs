// Tests for src/errors.mjs — the one kind of refusal, the defects of the
// runtime, the names of the classes and the location of a refusal.

import { describe, it, expect } from 'vitest';
import {
  QlangError,
  CallUnknownNameError,
  CallEvaluationDepthExceededError,
  QlangDefect,
  BuiltinRefusalDeclaredTwiceError,
  declareRefusal,
  declareForeignError,
  declaredRefusals
} from '../../src/errors.mjs';
import { keyword } from '../../src/types.mjs';

describe('QlangError base class', () => {
  it('[QSERR#site] carries its facts', () => {
    const qlangErr = new QlangError('boom', { count: 5 });
    expect(qlangErr.facts).toEqual({ count: 5 });
    expect(qlangErr.message).toBe('boom');
    expect(qlangErr.name).toBe('QlangError');
    expect(qlangErr).toBeInstanceOf(Error);
  });
});

// A refusal whose site hands no facts.
const TestsProbeError = declareRefusal('tests/ProbeError');

describe('a refusal declared by its address', () => {
  it('[QSERR#site] carries the facts its site hands, named by the last name of its address', () => {
    const unresolvedErr = new CallUnknownNameError({ name: keyword('foo') });
    expect(unresolvedErr).toBeInstanceOf(QlangError);
    expect(unresolvedErr.facts.name.name).toBe('foo');
    expect(unresolvedErr.name).toBe('UnknownNameError');
    expect(unresolvedErr.address).toBe('call/UnknownNameError');
  });

  it('[QSERR#site] says its address as its message, whatever facts its site hands', () => {
    expect(new TestsProbeError().message).toBe('::tests/ProbeError');
    expect(new CallEvaluationDepthExceededError({ depth: 11, limit: 10 }).message).toBe('::call/EvaluationDepthExceededError');
  });

  it('[QSERR#site] hands no facts where its site hands none', () => {
    const probeErr = new TestsProbeError();
    expect(probeErr.name).toBe('ProbeError');
    expect(probeErr.facts).toEqual({});
  });

  it('[QSERR#site] names the class of a refusal by the last name of its address', () => {
    expect(CallUnknownNameError.name).toBe('UnknownNameError');
    expect(TestsProbeError.name).toBe('ProbeError');
  });
});

describe('QlangDefect', () => {
  it('[QSERR#site] carries its message and its facts', () => {
    const defect = new QlangDefect('registration failed', { site: 'X', verb: 'foo' });
    expect(defect.message).toBe('registration failed');
    expect(defect.facts.site).toBe('X');
    expect(defect.facts.verb).toBe('foo');
    expect(defect).toBeInstanceOf(QlangError);
  });
});


describe('one address, one site', () => {
  // The address is the tag a refusal answers by and the name of its
  // page, so a second class under one address would speak for the
  // other site.
  it('[QSERR#site] lists every address a site declared, which the pages of the refusals are held against', () => {
    expect([...declaredRefusals()]).toEqual(expect.arrayContaining(['tests/ProbeError', 'call/UnknownNameError', 'builtin/RefusalDeclaredTwiceError']));
  });

  it('[QSERR#site] refuses a second declaration of an address already declared', () => {
    let refusal = null;
    try {
      declareRefusal('call/UnknownNameError');
    } catch (caught) {
      refusal = caught;
    }
    expect(refusal).toBeInstanceOf(QlangDefect);
    expect(refusal).toBeInstanceOf(BuiltinRefusalDeclaredTwiceError);
    expect(refusal.name).toBe('RefusalDeclaredTwiceError');
    expect(refusal.facts.address).toBe('call/UnknownNameError');
    expect(refusal.message).toContain('call/UnknownNameError');
  });
});

describe('declareForeignError — a failure of the embedding', () => {
  // The class stays off the QlangError hierarchy and carries the address
  // every other declaration stamps.
  it('[QSERR#site] declares a class outside the QlangError hierarchy that still names its site', () => {
    const TestsBridgeUnreachableError = declareForeignError('tests/BridgeUnreachableError',
      ({ endpoint }) => `host bridge at ${endpoint} answered nothing`);
    const foreignErr = new TestsBridgeUnreachableError({ endpoint: 'ipc://bridge' });

    expect(foreignErr).toBeInstanceOf(Error);
    expect(foreignErr).not.toBeInstanceOf(QlangError);
    expect(foreignErr.name).toBe('BridgeUnreachableError');
    expect(foreignErr.address).toBe('tests/BridgeUnreachableError');
    expect(foreignErr.facts.endpoint).toBe('ipc://bridge');
    expect(foreignErr.message).toContain('ipc://bridge');
  });
});

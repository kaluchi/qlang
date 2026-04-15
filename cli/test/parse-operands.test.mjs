// parseJson / parseTjson coverage. Each parser is exercised through
// runQuery so the bound operand path, the per-site error sites, and
// the qlang-shape conversion all fire against a real session.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { keyword } from '@kaluchi/qlang-core';
import { expectOperandErrorThrown } from './helpers/error-assertions.mjs';

const noopIo = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

describe('parseJson — happy path', () => {
  it('lifts a JSON object into a Map with keyword keys', async () => {
    const cellEntry = await runQuery('"{\\"name\\":\\"alice\\"}" | parseJson', noopIo);
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBeInstanceOf(Map);
    expect(cellEntry.result.get(keyword('name'))).toBe('alice');
  });

  it('lifts a JSON array into a Vec', async () => {
    const cellEntry = await runQuery('"[1, 2, 3]" | parseJson', noopIo);
    expect(cellEntry.result).toEqual([1, 2, 3]);
  });

  it('preserves nested objects and arrays through recursive lift', async () => {
    const cellEntry = await runQuery(
      '"{\\"items\\":[{\\"k\\":1},{\\"k\\":2}]}" | parseJson | /items * /k',
      noopIo);
    expect(cellEntry.result).toEqual([1, 2]);
  });

  it('passes scalar JSON through unchanged', async () => {
    const cellEntry = await runQuery('"42" | parseJson', noopIo);
    expect(cellEntry.result).toBe(42);
  });
});

describe('parseJson — error sites', () => {
  it('lifts ParseJsonSubjectNotString when the subject is not a String', async () => {
    const cellEntry = await runQuery('42 | parseJson', noopIo);
    expectOperandErrorThrown(cellEntry, 'ParseJsonSubjectNotString', {
      operand: 'parseJson',
      position: 'subject',
      expectedType: 'String',
      actualType: 'Number'
    });
  });

  it('lifts ParseJsonInvalidJson when the subject is not valid JSON', async () => {
    const cellEntry = await runQuery('"{not json" | parseJson', noopIo);
    const thrown = expectOperandErrorThrown(cellEntry, 'ParseJsonInvalidJson', {});
    expect(typeof thrown.context.message).toBe('string');
    expect(thrown.context.message.length).toBeGreaterThan(0);
  });
});

describe('parseTjson — happy path', () => {
  it('round-trips a qlang Set through tjson | parseTjson', async () => {
    const cellEntry = await runQuery('#{:admin :user} | tjson | parseTjson | count', noopIo);
    expect(cellEntry.result).toBe(2);
  });

  it('round-trips a Map with keyword values, restoring keyword identity', async () => {
    const cellEntry = await runQuery(
      '{:role :admin} | tjson | parseTjson | /role',
      noopIo);
    expect(cellEntry.result).toBe(keyword('admin'));
  });

  it('round-trips a Vec of mixed scalars verbatim', async () => {
    const cellEntry = await runQuery(
      '[1 "two" :three null] | tjson | parseTjson',
      noopIo);
    expect(cellEntry.result).toEqual([1, 'two', keyword('three'), null]);
  });
});

describe('parseTjson — error sites', () => {
  it('lifts ParseTjsonSubjectNotString when the subject is not a String', async () => {
    const cellEntry = await runQuery('42 | parseTjson', noopIo);
    expectOperandErrorThrown(cellEntry, 'ParseTjsonSubjectNotString', {
      operand: 'parseTjson',
      position: 'subject',
      expectedType: 'String',
      actualType: 'Number'
    });
  });

  it('lifts ParseTjsonInvalidJson when the subject is not valid JSON', async () => {
    const cellEntry = await runQuery('"{not json" | parseTjson', noopIo);
    const thrown = expectOperandErrorThrown(cellEntry, 'ParseTjsonInvalidJson', {});
    expect(typeof thrown.context.message).toBe('string');
    expect(thrown.context.message.length).toBeGreaterThan(0);
  });
});

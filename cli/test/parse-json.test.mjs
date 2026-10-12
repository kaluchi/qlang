// parseJson coverage. The parser is exercised through
// runQuery so the bound word's path, the per-site error sites, and
// the qlang-shape conversion all fire against a real session.
// The decisions it exists for: [D76], [D232].

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { expectRefusalRaised, expectRefusalByAddress } from './helpers/error-assertions.mjs';

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
    expect(cellEntry.result.get('name')).toBe('alice');
  });

  it('lifts a JSON array into a Vec', async () => {
    const cellEntry = await runQuery('"[1, 2, 3]" | parseJson', noopIo);
    expect(cellEntry.result).toEqual([1, 2, 3]);
  });

  it('preserves nested objects and arrays through recursive lift', async () => {
    const cellEntry = await runQuery(
      '"{\\"items\\":[{\\"k\\":1},{\\"k\\":2}]}" | parseJson | /items | map ~/k',
      noopIo);
    expect(cellEntry.result).toEqual([1, 2]);
  });

  it('passes scalar JSON through unchanged', async () => {
    const cellEntry = await runQuery('"42" | parseJson', noopIo);
    expect(cellEntry.result).toBe(42);
  });
});

describe('parseJson — error sites', () => {
  it('refuses a subject that is not a string under the address of parseJson', async () => {
    const cellEntry = await runQuery('42 | parseJson', noopIo);
    expectRefusalByAddress(cellEntry, 'string/parseJson/SubjectNotStringError', {
      actualType: { name: 'number' }
    });
  });

  it('lifts StringParseJsonTextNotJsonError when the subject is not valid JSON', async () => {
    const cellEntry = await runQuery('"{not json" | parseJson', noopIo);
    const thrown = expectRefusalRaised(cellEntry, 'string/parseJson/TextNotJsonError', {});
    expect(typeof thrown.facts.message).toBe('string');
    expect(thrown.facts.message.length).toBeGreaterThan(0);
  });
});

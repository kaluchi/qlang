// parseJson coverage. The parser is exercised through
// runQuery so the bound word's path, the per-site error sites, and
// the qlang-shape conversion all fire against a real session.
// The decisions it exists for: [D7], [D34].

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';
import { expectRefusalRaised, expectRefusalByAddress } from './helpers/error-assertions.mjs';
import { silentStreams } from './helpers/silent-streams.mjs';

describe('parseJson — happy path', () => {
  it('lifts a JSON object into a Map with keyword keys', async () => {
    const cellEntry = await runQuery('"{\\"name\\":\\"alice\\"}" | parseJson', silentStreams);
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBeInstanceOf(Map);
    expect(cellEntry.result.get('name')).toBe('alice');
  });

  it('lifts a JSON array into a Vec', async () => {
    const cellEntry = await runQuery('"[1, 2, 3]" | parseJson', silentStreams);
    expect(cellEntry.result).toEqual([1, 2, 3]);
  });

  it('preserves nested objects and arrays through recursive lift', async () => {
    const cellEntry = await runQuery(
      '"{\\"items\\":[{\\"k\\":1},{\\"k\\":2}]}" | parseJson | get /items | map /k',
      silentStreams);
    expect(cellEntry.result).toEqual([1, 2]);
  });

  it('passes scalar JSON through unchanged', async () => {
    const cellEntry = await runQuery('"42" | parseJson', silentStreams);
    expect(cellEntry.result).toBe(42);
  });
});

describe('parseJson — error sites', () => {
  it('refuses a subject that is not a string under the address of parseJson', async () => {
    const cellEntry = await runQuery('42 | parseJson', silentStreams);
    expectRefusalByAddress(cellEntry, 'string/parseJson/SubjectNotStringError', {
      actualType: { name: 'number' }
    });
  });

  it('lifts StringParseJsonTextNotJsonError when the subject is not valid JSON', async () => {
    const cellEntry = await runQuery('"{not json" | parseJson', silentStreams);
    const thrown = expectRefusalRaised(cellEntry, 'string/parseJson/TextNotJsonError', {});
    expect(typeof thrown.facts.message).toBe('string');
    expect(thrown.facts.message.length).toBeGreaterThan(0);
  });
});

// Standard input of the command line. readStdinToString sits at the boundary
// between Node's Readable stream protocol and the qlang `in` verb contract —
// every branch (a terminal answering at once, data accumulation, end
// resolution, error rejection) is exercised through synthetic streams.
// memoiseStdinReader's caching behaviour is tested with a counting stub, and
// `liftStdinToPipeValue` resolves the `auto` / `json` / `raw` flag into the
// query's first value.
// The rules it holds: [QSHST#stdin].

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { readStdinToString, memoiseStdinReader, DEFAULT_SUBJECT, liftStdinToPipeValue } from '../src/stdin.mjs';

describe('readStdinToString', () => {
  it('returns the empty string when the stream reports isTTY', async () => {
    const ttyStub = { isTTY: true };
    const text = await readStdinToString(ttyStub);
    expect(text).toBe('');
  });

  it('accumulates chunks from a piped stream and resolves on end', async () => {
    const piped = Readable.from(['hello ', 'world']);
    piped.isTTY = false;
    const text = await readStdinToString(piped);
    expect(text).toBe('hello world');
  });

  it('rejects when the underlying stream emits an error', async () => {
    const failing = new Readable({ read() {} });
    failing.isTTY = false;
    setImmediate(() => failing.emit('error', new Error('stream broke')));
    await expect(readStdinToString(failing)).rejects.toThrow('stream broke');
  });
});

describe('memoiseStdinReader', () => {
  it('calls the underlying reader at most once across repeated invocations', async () => {
    let invocationCount = 0;
    const memoised = memoiseStdinReader(() => {
      invocationCount += 1;
      return Promise.resolve('payload');
    });
    const first = await memoised();
    const second = await memoised();
    expect(first).toBe('payload');
    expect(second).toBe('payload');
    expect(invocationCount).toBe(1);
  });
});

describe('liftStdinToPipeValue — auto detection', () => {
  it('starts from the default subject when stdin carries no bytes, in every mode', () => {
    for (const stdinFormat of ['auto', 'json', 'raw']) {
      expect(liftStdinToPipeValue('', stdinFormat)).toEqual({ pipeValue: DEFAULT_SUBJECT });
    }
    expect(DEFAULT_SUBJECT.name).toBe('qlang');
  });

  it('parses JSON stdin into the values of qlang when auto succeeds', () => {
    expect(liftStdinToPipeValue('{"a": 1}', 'auto').pipeValue.get('a')).toBe(1);
  });

  it('keeps the keys of a JSON stdin in the order the text writes them, as a literal does', () => {
    expect([...liftStdinToPipeValue('{"b": 1, "2": 2, "a": 3}', 'auto').pipeValue.keys()]).toEqual(['b', '2', 'a']);
  });

  it('falls back to raw String when stdin is not valid JSON', () => {
    expect(liftStdinToPipeValue('plain text', 'auto')).toEqual({ pipeValue: 'plain text' });
  });
});

describe('liftStdinToPipeValue — explicit formats', () => {
  it('parses strictly under --json', () => {
    expect(liftStdinToPipeValue('[1, 2, 3]', 'json').pipeValue).toEqual([1, 2, 3]);
  });

  it('surfaces parseError on a text --json cannot read', () => {
    const lifted = liftStdinToPipeValue('not-json', 'json');
    expect(lifted.parseError).toBeInstanceOf(Error);
    expect(lifted.parseError.message).toMatch(/JSON/);
  });

  it('skips parsing entirely under --raw', () => {
    expect(liftStdinToPipeValue('{"a":1}', 'raw')).toEqual({ pipeValue: '{"a":1}' });
  });
});

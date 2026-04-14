// io-stdin coverage. readStdinToString sits at the boundary between
// Node's Readable stream protocol and the qlang `@in` operand
// contract — every branch (TTY short-circuit, data accumulation,
// end resolution, error rejection) is exercised through synthetic
// streams. memoiseStdinReader's caching behaviour is tested with
// a counting stub.

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { readStdinToString, memoiseStdinReader } from '../src/io-stdin.mjs';

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

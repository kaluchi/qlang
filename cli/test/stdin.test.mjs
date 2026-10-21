// Standard input of the command line. readStdinToString sits at the boundary
// between Node's Readable stream protocol and the text the command line reads
// before a query that reads its subject and `in` answers — every branch (a
// terminal answering at once, data accumulation, end resolution, error
// rejection) is exercised through synthetic streams. memoiseStdinReader's
// caching behaviour is tested with a counting stub, and `liftOfInput` lifts
// the text to the query's first value by `parseJson`, or as it came under
// `--raw`.
// The rules it holds: [QSHST#stdin].

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { createSession } from '@kaluchi/qlang-core';
import { readStdinToString, memoiseStdinReader, DEFAULT_SUBJECT, liftOfInput } from '../src/stdin.mjs';

describe('readStdinToString', () => {
  it('[QSHST#stdin] returns the empty string when the stream reports isTTY', async () => {
    const ttyStub = { isTTY: true };
    const text = await readStdinToString(ttyStub);
    expect(text).toBe('');
  });

  it('[QSHST#stdin] accumulates chunks from a piped stream and resolves on end', async () => {
    const piped = Readable.from(['hello ', 'world']);
    piped.isTTY = false;
    const text = await readStdinToString(piped);
    expect(text).toBe('hello world');
  });

  it('[QSHST#stdin] rejects when the underlying stream emits an error', async () => {
    const failing = new Readable({ read() {} });
    failing.isTTY = false;
    setImmediate(() => failing.emit('error', new Error('stream broke')));
    await expect(readStdinToString(failing)).rejects.toThrow('stream broke');
  });
});

describe('memoiseStdinReader', () => {
  it('[QSHST#stdin] calls the underlying reader at most once across repeated invocations', async () => {
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

describe('liftOfInput — the first value standard input lifts to by parseJson', () => {
  it('[QSHST#stdin] starts from the noun of the language when stdin carries no bytes, raw or not', async () => {
    const session = await createSession();
    expect([await liftOfInput(session, '', false), await liftOfInput(session, '', true)]).toEqual([{ initialPipeValue: DEFAULT_SUBJECT }, { initialPipeValue: DEFAULT_SUBJECT }]);
    expect(DEFAULT_SUBJECT.name).toBe('qlang');
  });

  it('[QSHST#stdin] reads a JSON text as its value, the keys of an object in the order the text writes them', async () => {
    const { initialPipeValue } = await liftOfInput(await createSession(), '{"b": 1, "2": 2, "a": 3}', false);
    expect([...initialPipeValue.keys()]).toEqual(['b', '2', 'a']);
  });

  it('[QSHST#stdin] reads a text that is no JSON as one string', async () => {
    expect(await liftOfInput(await createSession(), 'plain text', false)).toEqual({ initialPipeValue: 'plain text' });
  });

  it('[QSHST#stdin] reads the text as it came under --raw', async () => {
    expect(await liftOfInput(await createSession(), '{"a":1}', true)).toEqual({ initialPipeValue: '{"a":1}' });
  });

  it('[QSHST#stdin] lifts a JSON text parseJson refuses to the failure it answered, the session numbering no cell for the lift', async () => {
    const session = await createSession();
    const { initialPipeValue } = await liftOfInput(session, '[1e400]', false);
    expect(initialPipeValue.tag.name).toBe('string/parseJson/NumberNotFiniteError');
    expect((await session.evalCell('1')).uri).toBe('cell-1');
  });
});

import { describe, it, expect } from 'vitest';
import { parseArgv } from '../../src/argv.mjs';
import { Readable } from 'node:stream';
import { main } from '../../src/main.mjs';
import { runQuery } from '../../src/run.mjs';
import { captureIoContext } from '../helpers/captured-streams.mjs';
import { createSession } from '@kaluchi/qlang-core';
import { readStdinToString, memoiseStdinReader, DEFAULT_SUBJECT, liftOfInput } from '../../src/stdin.mjs';
import { captureStreams } from '../helpers/main-streams.mjs';

describe('parseArgv', () => {
  it('parses --raw, stdin read as one string, before the query', () => {
    expect(parseArgv(['--raw', 'append " world"'])).toEqual({
      kind: 'evalQuery',
      queryText: 'append " world"',
      stdinFormat: 'raw',
      colorMode: 'auto',
      failureExitCode: 0
    });
  });
});

// A query that reads no subject runs without waiting on standard input,
// which a shell may hand open with nothing piped.
describe('main — standard input read for a query that reads its subject', () => {
  const openStdin = () => Object.assign(new Readable({ read() {} }), { isTTY: false });

  it('answers a query that reads no subject over a stdin that never ends', async () => {
    const s = captureStreams();
    const exitCode = await main(['1 | add 1'], openStdin(), s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('2\n');
  });

  it('reads stdin when `in` is called by a query that reads no subject', async () => {
    const s = captureStreams('piped text');
    await main(['"x" | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('piped text\n');
  });

  it('lifts nothing for a query headed by `in`, called by its name or its address, which reads the text as it came', async () => {
    for (const query of ['in | count', 'any/in | count']) {
      const s = captureStreams('[1e400]');
      await main([query], s.stdinStream, s.stdoutStream, s.stderrStream, {});
      expect(s.stdoutText(), query).toBe('7\n');
    }
  });

  it('lifts the subject for a query headed by a step of the fail track, which runs on a failure alone', async () => {
    for (const query of ['!| in | count', '!| 5 | count']) {
      const s = captureStreams('[1,2,3]');
      await main([query], s.stdinStream, s.stdoutStream, s.stderrStream, {});
      expect(s.stdoutText(), query).toBe('3\n');
    }
  });

  it('lifts the subject for `in` called by its name where the query declared a verb of that name before it', async () => {
    const s = captureStreams('[1,2,3]');
    await main([':vec/in ~(count) | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('3\n');
  });

  it('reads stdin once for the subject and for `in`', async () => {
    const s = captureStreams('hello world');
    await main(['count | in'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('hello world\n');
  });

  it('refuses a query that does not parse without reading stdin', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], openStdin(), s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::quote/ParseError!{');
  });
});

describe('main — the subject standard input lifts to', () => {
  it('starts from the noun of the language, `::qlang`, when stdin carries no bytes', async () => {
    const s = captureStreams();
    const exitCode = await main(['eq ::qlang'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('true\n');
  });

  it('reads stdin that is no JSON as one string', async () => {
    const s = captureStreams('plain text');
    const exitCode = await main(
      ['append " world"'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('plain text world\n');
  });

  it('uses raw mode on --raw whatever stdin holds', async () => {
    // Standard input reads as JSON, and `--raw` reads it as a string.
    const s = captureStreams('{"a":1}');
    const exitCode = await main(
      ['--raw', 'append " done"'],
      s.stdinStream, s.stdoutStream, s.stderrStream, {}
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{"a":1} done\n');
  });
});

describe('main — error paths', () => {
  it('answers a stdin magnitude outside the finite-double domain as parseJson refuses it, naming the path', async () => {
    // The answer is the refusal `parseJson` gives the text, its `:path` the path to the number [QSPRN#json].
    const s = captureStreams('{"big": 1e400, "n": 1}');
    const exitCode = await main(['count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stderrText()).toBe('');
    expect(s.stdoutText()).toContain('::string/parseJson/NumberNotFiniteError!{');
    expect(s.stdoutText()).toContain(':path /big');
  });

  it('hands the query a refusal of the lift as the failure it starts from, which its steps pass by and `!|` catches', async () => {
    const s = captureStreams('[1e400]');
    await main(['count !| get /trace/0/0'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(s.stdoutText()).toBe('[1e400]\n');
  });

  it('answers a bare out-of-range magnitude with no path', async () => {
    const s = captureStreams('1e400');
    const exitCode = await main(['count'], s.stdinStream, s.stdoutStream, s.stderrStream, {});
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toContain('::string/parseJson/NumberNotFiniteError!{');
    expect(s.stdoutText()).not.toMatch(/^ +:path /m);
  });
});

describe('runQuery', () => {
  it('lifts the text of standard input it is handed to the first value of the query', async () => {
    const cellEntry = await runQuery('get /k', captureIoContext(), { stdinText: '{"k": "v"}' });
    expect(cellEntry.result).toBe('v');
  });

  it('answers a defect the lift raised as the cell of the lift, the query unrun', async () => {
    const cellEntry = await runQuery('count', captureIoContext(), { stdinText: { length: 1 } });
    expect([cellEntry.source, cellEntry.result, cellEntry.defect.message]).toEqual(['parseJson', null, 'the core met object Object, a value of no kind of the language']);
  });
});

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

describe('liftOfInput — the first value standard input lifts to by parseJson', () => {
  it('starts from the noun of the language when stdin carries no bytes, raw or not', async () => {
    const session = await createSession();
    expect([await liftOfInput(session, '', false), await liftOfInput(session, '', true)]).toEqual([{ initialPipeValue: DEFAULT_SUBJECT }, { initialPipeValue: DEFAULT_SUBJECT }]);
    expect(DEFAULT_SUBJECT.name).toBe('qlang');
  });

  it('reads a JSON text as its value, the keys of an object in the order the text writes them', async () => {
    const { initialPipeValue } = await liftOfInput(await createSession(), '{"b": 1, "2": 2, "a": 3}', false);
    expect([...initialPipeValue.keys()]).toEqual(['b', '2', 'a']);
  });

  it('reads a text that is no JSON as one string', async () => {
    expect(await liftOfInput(await createSession(), 'plain text', false)).toEqual({ initialPipeValue: 'plain text' });
  });

  it('reads the text as it came under --raw', async () => {
    expect(await liftOfInput(await createSession(), '{"a":1}', true)).toEqual({ initialPipeValue: '{"a":1}' });
  });

  it('lifts a JSON text parseJson refuses to the failure it answered, the session numbering no cell for the lift', async () => {
    const session = await createSession();
    const { initialPipeValue } = await liftOfInput(session, '[1e400]', false);
    expect(initialPipeValue.tag.name).toBe('string/parseJson/NumberNotFiniteError');
    expect((await session.evalCell('1')).uri).toBe('cell-1');
  });
});

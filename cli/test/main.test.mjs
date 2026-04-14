// main orchestrator coverage. Every cliInvocation kind dispatches
// to its own branch; one test per branch, plus end-to-end flows
// that cover @out emission and the silent-on-error-value contract.
//
// Tests inject Readable / Writable stream stubs so the orchestrator
// runs without spawning a subprocess or touching `process.*`.

import { describe, it, expect } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { main } from '../src/main.mjs';

function captureStreams(stdinPayload = '') {
  const stdinStream = Readable.from([stdinPayload]);
  stdinStream.isTTY = false;

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutStream = new Writable({
    write(chunk, _encoding, cb) { stdoutChunks.push(chunk.toString()); cb(); }
  });
  const stderrStream = new Writable({
    write(chunk, _encoding, cb) { stderrChunks.push(chunk.toString()); cb(); }
  });

  return {
    stdinStream, stdoutStream, stderrStream,
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('main', () => {
  it('returns exit 0 and writes the help banner on --help', async () => {
    const s = captureStreams();
    const exitCode = await main(['--help'], s.stdinStream, s.stdoutStream, s.stderrStream);
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/Usage:/);
    expect(s.stderrText()).toBe('');
  });

  it('returns exit 0 and writes the version line on --version', async () => {
    const s = captureStreams();
    const exitCode = await main(['--version'], s.stdinStream, s.stdoutStream, s.stderrStream);
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/@kaluchi\/qlang-cli/);
    expect(s.stderrText()).toBe('');
  });

  it('returns exit 2 and writes a usage hint on an empty argv slice', async () => {
    const s = captureStreams();
    const exitCode = await main([], s.stdinStream, s.stdoutStream, s.stderrStream);
    expect(exitCode).toBe(2);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toMatch(/missing query/);
  });

  it('returns exit 0 and stays silent for a success-track query without `@out`', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2 3] | count'], s.stdinStream, s.stdoutStream, s.stderrStream);
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toBe('');
  });

  it('routes `@out` emissions to stdout for a success-track query', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | count | pretty | @out'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
    expect(s.stderrText()).toBe('');
  });

  it('feeds stdin into `@in` so the query sees the piped payload', async () => {
    const s = captureStreams('hello world');
    const exitCode = await main(
      ['@in | @out'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('hello world\n');
  });

  it('returns exit 1 with a stderr message for a parse failure', async () => {
    const s = captureStreams();
    const exitCode = await main(['[1 2'], s.stdinStream, s.stdoutStream, s.stderrStream);
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toMatch(/^qlang:/);
  });

  it('returns exit 1 silently for an unhandled fail-track error value', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | add(1)'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toBe('');
  });

  it('dispatches `--repl` into the readline REPL and exits cleanly on `.exit`', async () => {
    const s = captureStreams('.exit\n');
    const exitCode = await main(
      ['--repl'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/qlang>/);
  });
});

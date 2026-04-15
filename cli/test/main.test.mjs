// main orchestrator coverage. Every cliInvocation kind dispatches
// to its own branch; one test per branch, plus end-to-end flows
// that cover the script-mode auto-pipe contract (JSON in → JSON
// out, raw in → raw out, `@out` suppression).
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

describe('main — flag dispatch', () => {
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

  it('dispatches `--repl` into the line-editor REPL and exits cleanly on `.exit`', async () => {
    const s = captureStreams('.exit\n');
    const exitCode = await main(
      ['--repl'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toMatch(/qlang>/);
  });
});

describe('main — script mode auto-pipe', () => {
  it('feeds piped JSON as the initial pipeValue and emits JSON back', async () => {
    const s = captureStreams('{"user": {"name": "alice"}}');
    const exitCode = await main(
      ['/user/name'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    // Raw JSON string output — a String success value under json
    // format encodes as a JSON string literal.
    expect(s.stdoutText()).toBe('"alice"\n');
    expect(s.stderrText()).toBe('');
  });

  it('encodes a Map projection as pretty JSON when the input was JSON', async () => {
    const s = captureStreams('{"a": {"b": 1, "c": 2}}');
    const exitCode = await main(
      ['/a'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{\n  "b": 1,\n  "c": 2\n}\n');
  });

  it('emits a literal query result as JSON when stdin was JSON', async () => {
    const s = captureStreams('[1, 2, 3]');
    const exitCode = await main(
      ['count'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
  });

  it('falls back to raw mode when stdin fails JSON.parse', async () => {
    const s = captureStreams('plain text');
    const exitCode = await main(
      ['append(" world")'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('plain text world\n');
  });

  it('uses raw mode on --raw regardless of stdin shape', async () => {
    // Input is valid JSON but `--raw` forces the String path.
    const s = captureStreams('{"a":1}');
    const exitCode = await main(
      ['--raw', 'append(" done")'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('{"a":1} done\n');
  });

  it('hard-fails on --json with malformed stdin', async () => {
    const s = captureStreams('not-json');
    const exitCode = await main(
      ['--json', '/x'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(1);
    expect(s.stdoutText()).toBe('');
    expect(s.stderrText()).toMatch(/^qlang: --json input:/);
  });

  it('emits the query value on empty stdin via raw fallback', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | count'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('3\n');
    expect(s.stderrText()).toBe('');
  });
});

describe('main — `@out` suppression of auto-encoded stdout', () => {
  it('routes `@out` emissions to stdout and skips the auto-encode', async () => {
    const s = captureStreams();
    const exitCode = await main(
      ['[1 2 3] | count | pretty | @out'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    // `@out` wrote '3\n' during eval — no trailing duplicate from
    // the renderer.
    expect(s.stdoutText()).toBe('3\n');
    expect(s.stderrText()).toBe('');
  });

  it('feeds stdin into `@in` alongside the auto-pipe so explicit queries still work', async () => {
    const s = captureStreams('hello world');
    const exitCode = await main(
      ['@in | @out'],
      s.stdinStream, s.stdoutStream, s.stderrStream
    );
    expect(exitCode).toBe(0);
    expect(s.stdoutText()).toBe('hello world\n');
  });
});

describe('main — error paths', () => {
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
});

// REPL coverage. Driving readline through synthetic Readable input
// confirms every meta-command branch, the auto-print contract for
// success/error/JS-throw cell outcomes, and the persistence of
// bindings across cells inside one session.

import { describe, it, expect } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { runRepl } from '../src/repl.mjs';

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_PATTERN, '');
}

function captureRepl(scriptedInput) {
  const stdinStream = Readable.from([scriptedInput]);
  stdinStream.isTTY = false;

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutWrite = (text) => stdoutChunks.push(text);
  const stderrWrite = (text) => stderrChunks.push(text);

  return {
    stdinStream,
    stdoutWrite,
    stderrWrite,
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('runRepl — meta commands', () => {
  it('closes on `.exit` and resolves to exit code 0', async () => {
    const r = captureRepl('.exit\n');
    const exitCode = await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(exitCode).toBe(0);
  });

  it('writes the help banner on `.help` and stays open until EOF', async () => {
    const r = captureRepl('.help\n');
    const exitCode = await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(exitCode).toBe(0);
    expect(r.stdoutText()).toMatch(/Meta commands:/);
    expect(r.stdoutText()).toMatch(/\.exit/);
  });

  it('skips empty lines and reprompts without evaluating', async () => {
    const r = captureRepl('\n\n.exit\n');
    const exitCode = await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(exitCode).toBe(0);
    expect(r.stderrText()).toBe('');
  });
});

describe('runRepl — query evaluation', () => {
  it('auto-prints the success-track value of a single cell', async () => {
    const r = captureRepl('[1 2 3] | count\n.exit\n');
    await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(stripAnsi(r.stdoutText())).toMatch(/3/);
  });

  it('preserves bindings between cells within the same session', async () => {
    const r = captureRepl('let(:double, mul(2))\n10 | double\n.exit\n');
    await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(stripAnsi(r.stdoutText())).toMatch(/20/);
  });

  it('auto-prints a fail-track error value on stderr (still exit 0 on close)', async () => {
    const r = captureRepl('[1 2 3] | add(1)\n.exit\n');
    const exitCode = await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(exitCode).toBe(0);
    expect(stripAnsi(r.stderrText())).toMatch(/!\{/);
  });

  it('writes a JS host-throw message on stderr for parse failures', async () => {
    const r = captureRepl('[1 2\n.exit\n');
    await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(r.stderrText()).toMatch(/^error:/m);
  });
});

describe('runRepl — output highlighting', () => {
  it('paints the printed result with ANSI escape sequences', async () => {
    const r = captureRepl('[1 2 3]\n.exit\n');
    await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    // Numbers render under the yellow escape; brackets under punct.
    expect(r.stdoutText()).toMatch(/\x1b\[33m/);
  });

  it('paints the prompt with bold-cyan escape on every line', async () => {
    const r = captureRepl('.exit\n');
    await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    expect(r.stdoutText()).toMatch(/\x1b\[1;36m/);
    expect(r.stdoutText()).toMatch(/qlang>/);
  });

  it('exercises the per-keystroke render callback in TTY mode', async () => {
    // Drive the editor in TTY mode so its raw-mode redraw path
    // calls into the REPL's render callback (which paints the
    // current buffer through highlightAnsi). Every visible
    // keystroke should leave a yellow-number escape behind in
    // stdout — the only way that escape can appear before Enter
    // is via the live-render hook.
    const ttyStdin = new (await import('node:stream')).PassThrough();
    ttyStdin.isTTY = true;
    ttyStdin.setRawMode = () => {};

    const stdoutChunks = [];
    const stderrChunks = [];
    const stdoutWrite = (text) => stdoutChunks.push(text);
    const stderrWrite = (text) => stderrChunks.push(text);

    const replPromise = runRepl(ttyStdin, stdoutWrite, stderrWrite);
    // Type "42", which should redraw with the yellow escape, then
    // submit Enter, then close on Ctrl+D from an empty buffer.
    ttyStdin.write(Buffer.from('42'));
    ttyStdin.write(Buffer.from('\r'));
    await new Promise((r) => setImmediate(r));
    ttyStdin.write(Buffer.from([0x04])); // Ctrl+D on empty buffer
    await replPromise;

    const stdoutText = stdoutChunks.join('');
    expect(stdoutText).toMatch(/\x1b\[33m4/);
  });
});

describe('runRepl — @in / @out behaviour', () => {
  it('binds `@in` to return the empty String so the cell does not deadlock against the prompt', async () => {
    const r = captureRepl('@in | pretty | @out\n.exit\n');
    await runRepl(r.stdinStream, r.stdoutWrite, r.stderrWrite);
    // `@in` resolves to ''. pretty renders it as the qlang String
    // literal `""`. @out writes that to stdout, then the REPL
    // auto-prints the cell's success-track value (also `""`). The
    // captured output therefore contains the empty-String literal.
    expect(stripAnsi(r.stdoutText())).toMatch(/""/);
  });
});

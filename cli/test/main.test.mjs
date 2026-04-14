// main orchestrator coverage. Every cliInvocation kind dispatches
// to its own branch; one test per branch, plus end-to-end flows that
// cover @out emission and the silent-on-error-value contract.

import { describe, it, expect } from 'vitest';
import { main } from '../src/main.mjs';

function captureWriters(stdinPayload = '') {
  const stdoutChunks = [];
  const stderrChunks = [];
  return {
    stdinReader: () => Promise.resolve(stdinPayload),
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('main', () => {
  it('returns exit 0 and writes the help banner on --help', async () => {
    const w = captureWriters();
    const exitCode = await main(['--help'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(0);
    expect(w.stdoutText()).toMatch(/Usage:/);
    expect(w.stderrText()).toBe('');
  });

  it('returns exit 0 and writes the version line on --version', async () => {
    const w = captureWriters();
    const exitCode = await main(['--version'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(0);
    expect(w.stdoutText()).toMatch(/@kaluchi\/qlang-cli/);
    expect(w.stderrText()).toBe('');
  });

  it('returns exit 2 and writes a usage hint on an empty argv slice', async () => {
    const w = captureWriters();
    const exitCode = await main([], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(2);
    expect(w.stdoutText()).toBe('');
    expect(w.stderrText()).toMatch(/missing query/);
  });

  it('returns exit 0 and stays silent for a success-track query without `@out`', async () => {
    const w = captureWriters();
    const exitCode = await main(['[1 2 3] | count'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(0);
    expect(w.stdoutText()).toBe('');
    expect(w.stderrText()).toBe('');
  });

  it('routes `@out` emissions to stdout for a success-track query', async () => {
    const w = captureWriters();
    const exitCode = await main(['[1 2 3] | count | pretty | @out'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(0);
    expect(w.stdoutText()).toBe('3\n');
    expect(w.stderrText()).toBe('');
  });

  it('feeds stdin into `@in` so the query sees the piped payload', async () => {
    const w = captureWriters('hello world');
    const exitCode = await main(['@in | @out'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(0);
    expect(w.stdoutText()).toBe('hello world\n');
  });

  it('returns exit 1 with a stderr message for a parse failure', async () => {
    const w = captureWriters();
    const exitCode = await main(['[1 2'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(1);
    expect(w.stdoutText()).toBe('');
    expect(w.stderrText()).toMatch(/^qlang:/);
  });

  it('returns exit 1 silently for an unhandled fail-track error value', async () => {
    const w = captureWriters();
    const exitCode = await main(['[1 2 3] | add(1)'], w.stdinReader, w.stdoutWrite, w.stderrWrite);
    expect(exitCode).toBe(1);
    expect(w.stdoutText()).toBe('');
    expect(w.stderrText()).toBe('');
  });
});

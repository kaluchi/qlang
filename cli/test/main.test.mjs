// main orchestrator coverage. Every cliInvocation kind dispatches
// to its own branch; one test per branch, plus one for the
// success-track evalQuery flow that ties argv → run → render
// end-to-end without spawning a subprocess.

import { describe, it, expect } from 'vitest';
import { main } from '../src/main.mjs';

function captureWriters() {
  const stdoutChunks = [];
  const stderrChunks = [];
  return {
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('main', () => {
  it('returns exit code 0 and writes the help banner on --help', async () => {
    const writers = captureWriters();
    const exitCode = await main(['--help'], writers.stdoutWrite, writers.stderrWrite);
    expect(exitCode).toBe(0);
    expect(writers.stdoutText()).toMatch(/Usage:/);
    expect(writers.stderrText()).toBe('');
  });

  it('returns exit code 0 and writes the version line on --version', async () => {
    const writers = captureWriters();
    const exitCode = await main(['--version'], writers.stdoutWrite, writers.stderrWrite);
    expect(exitCode).toBe(0);
    expect(writers.stdoutText()).toMatch(/@kaluchi\/qlang-cli/);
    expect(writers.stderrText()).toBe('');
  });

  it('returns exit code 2 and writes a usage hint on an empty argv slice', async () => {
    const writers = captureWriters();
    const exitCode = await main([], writers.stdoutWrite, writers.stderrWrite);
    expect(exitCode).toBe(2);
    expect(writers.stdoutText()).toBe('');
    expect(writers.stderrText()).toMatch(/missing query/);
  });

  it('returns exit code 0 and writes the printValue result for a success-track query', async () => {
    const writers = captureWriters();
    const exitCode = await main(['[1 2 3] | count'], writers.stdoutWrite, writers.stderrWrite);
    expect(exitCode).toBe(0);
    expect(writers.stdoutText()).toBe('3\n');
    expect(writers.stderrText()).toBe('');
  });

  it('returns exit code 1 and writes the error to stderr for a parse failure', async () => {
    const writers = captureWriters();
    const exitCode = await main(['[1 2'], writers.stdoutWrite, writers.stderrWrite);
    expect(exitCode).toBe(1);
    expect(writers.stdoutText()).toBe('');
    expect(writers.stderrText()).toMatch(/^qlang:/);
  });

  it('returns exit code 1 and writes the error value to stderr for a fail-track result', async () => {
    const writers = captureWriters();
    // `add(1)` against a Vec subject lifts a FilterSubjectNotVec-style
    // error onto the fail-track; pipeline ends with an error value.
    const exitCode = await main(['[1 2 3] | add(1)'], writers.stdoutWrite, writers.stderrWrite);
    expect(exitCode).toBe(1);
    expect(writers.stdoutText()).toBe('');
    expect(writers.stderrText()).toMatch(/^!\{/);
  });
});

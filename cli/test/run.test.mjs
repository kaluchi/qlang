// run.mjs is the seam between cli-level intent (a query string, an
// ioContext, and an optional initial pipeValue) and core-level
// evaluation (a cell entry). Tests exercise the success path, the
// parse-failure path, the `@out` writer reaching the captured
// stdout, and the `initialPipeValue` seed that lets the CLI script
// mode deliver parsed stdin as the query's implicit subject.

import { describe, it, expect } from 'vitest';
import { isErrorValue } from '@kaluchi/qlang-core';
import { runQuery } from '../src/run.mjs';


function captureIoContext() {
  const stdoutChunks = [];
  const stderrChunks = [];
  let recordedStdout = 0;
  return {
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    recordStdoutEffect: () => { recordedStdout += 1; },
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join(''),
    stdoutEffectCount: () => recordedStdout
  };
}

describe('runQuery', () => {
  it('materialises a cell entry from a freshly seeded session', async () => {
    const cellEntry = await runQuery('[1 2 3] | sum', captureIoContext());
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(6);
    expect(cellEntry.source).toBe('[1 2 3] | sum');
  });

  it('captures a parse error on the cell entry as both a host-error marker and a lifted ErrorValue', async () => {
    // Parse failures land on both channels — the JS instance on
    // `cellEntry.error` drives non-zero exit code in script-mode,
    // and the structured `::ParseError!{…}` ErrorValue on
    // `cellEntry.result` carries `:expected` / `:found` / `:source`
    // / `:marker` for the printValue diagnostic.
    const cellEntry = await runQuery('[1 2', captureIoContext());
    expect(cellEntry.error).not.toBeNull();
    expect(cellEntry.error.name).toBe('ParseError');
    expect(cellEntry.result).not.toBeNull();
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.tag.name).toBe('ParseError');
  });

  it('binds the ioContext writers so ~{@out} reaches the captured stdout chunks', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"qlang" | @out', io);
    expect(cellEntry.error).toBeNull();
    expect(io.stdoutText()).toBe('qlang\n');
    expect(io.stdoutEffectCount()).toBe(1);
  });

  it('seeds the cell pipeValue from runOpts.initialPipeValue', async () => {
    const io = captureIoContext();
    const seeded = new Map([['k', 'v']]);
    const cellEntry = await runQuery('/k', io, { initialPipeValue: seeded });
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe('v');
  });
});

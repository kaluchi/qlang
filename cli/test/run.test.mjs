// run.mjs is the seam between cli-level intent (a query string plus
// an ioContext) and core-level evaluation (a cell entry). Tests
// exercise the success path, the parse-failure path, and confirm
// the ioContext writers reach the bound `@out` operand.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';

function captureIoContext() {
  const stdoutChunks = [];
  const stderrChunks = [];
  return {
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('runQuery', () => {
  it('materialises a cell entry from a freshly seeded session', async () => {
    const cellEntry = await runQuery('[1 2 3] | sum', captureIoContext());
    expect(cellEntry.error).toBeNull();
    expect(cellEntry.result).toBe(6);
    expect(cellEntry.source).toBe('[1 2 3] | sum');
  });

  it('captures a parse error on the cell entry without throwing', async () => {
    const cellEntry = await runQuery('[1 2', captureIoContext());
    expect(cellEntry.error).not.toBeNull();
    expect(cellEntry.result).toBeNull();
  });

  it('binds the ioContext writers so `@out` reaches the captured stdout chunks', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"qlang" | @out', io);
    expect(cellEntry.error).toBeNull();
    expect(io.stdoutText()).toBe('qlang\n');
  });
});

// format-operands coverage. `pretty` is a single-line nullary that
// exposes core's printValue as an operand; one round-trip per qlang
// type confirms the bind reaches the runtime correctly.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';

const noopIo = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

describe('pretty', () => {
  it('renders a number as its qlang literal form', async () => {
    const cellEntry = await runQuery('42 | pretty', noopIo);
    expect(cellEntry.result).toBe('42');
  });

  it('renders a String quoted as a qlang String literal', async () => {
    const cellEntry = await runQuery('"hello" | pretty', noopIo);
    expect(cellEntry.result).toBe('"hello"');
  });

  it('renders a Vec as the literal `[1 2 3]`', async () => {
    const cellEntry = await runQuery('[1 2 3] | pretty', noopIo);
    expect(cellEntry.result).toBe('[1 2 3]');
  });

  it('renders a keyword with the leading colon', async () => {
    const cellEntry = await runQuery(':active | pretty', noopIo);
    expect(cellEntry.result).toBe(':active');
  });
});

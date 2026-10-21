// run.mjs is the seam between cli-level intent (a query string, an
// ioContext, and the text of standard input) and core-level evaluation (a
// cell entry). Tests exercise the success path, the parse-failure path, the
// `out` writer reaching the captured stdout, and the text lifted to the
// query's first value.
// The rules it holds: [QSHST#answer], [QSHST#stdin].

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
  it('[QSHST#source] materialises a cell entry from a freshly seeded session', async () => {
    const cellEntry = await runQuery('[1 2 3] | sum', captureIoContext());
    expect(cellEntry.defect).toBeNull();
    expect(cellEntry.result).toBe(6);
    expect(cellEntry.source).toBe('[1 2 3] | sum');
  });

  it('[QSHST#source] answers a query that does not parse by its failure, the cell no defect', async () => {
    const cellEntry = await runQuery('[1 2', captureIoContext());
    expect(cellEntry.defect).toBeNull();
    expect(isErrorValue(cellEntry.result)).toBe(true);
    expect(cellEntry.result.tag.name).toBe('quote/ParseError');
  });

  it('[QSHST#effect] binds the ioContext writers so `out` reaches the captured stdout chunks', async () => {
    const io = captureIoContext();
    const cellEntry = await runQuery('"qlang" | out', io);
    expect(cellEntry.defect).toBeNull();
    expect(io.stdoutText()).toBe('qlang\n');
    expect(io.stdoutEffectCount()).toBe(1);
  });

  it('[QSHST#stdin] lifts the text of standard input it is handed to the first value of the query', async () => {
    const cellEntry = await runQuery('get /k', captureIoContext(), { stdinText: '{"k": "v"}' });
    expect(cellEntry.result).toBe('v');
  });

  it('[QSHST#stdin] answers a defect the lift raised as the cell of the lift, the query unrun', async () => {
    const cellEntry = await runQuery('count', captureIoContext(), { stdinText: { length: 1 } });
    expect([cellEntry.source, cellEntry.result, cellEntry.defect.message]).toEqual(['parseJson', null, 'the core met object Object, a value of no kind of the language']);
  });
});

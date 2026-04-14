// render branch coverage. renderCellOutcome routes a cell entry
// onto one of three dispositions — thrown JS error, fail-track
// error value, or success-track value. One test per disposition.

import { describe, it, expect } from 'vitest';
import { renderCellOutcome } from '../src/render.mjs';
import { createSession } from '@kaluchi/qlang-core/session';
import { makeErrorValue, keyword } from '@kaluchi/qlang-core';

describe('renderCellOutcome', () => {
  it('routes a thrown setup-time error onto stderr with exit 1', () => {
    const cellEntry = {
      source: 'broken',
      uri: 'cell-1',
      ast: null,
      result: null,
      error: new Error('parse blew up'),
      envAfterCell: new Map()
    };
    const cliOutcome = renderCellOutcome(cellEntry);
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('qlang: parse blew up\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('routes a fail-track error value onto stderr with exit 1', () => {
    const errorDescriptor = new Map([
      [keyword('thrown'), keyword('FilterSubjectNotVec')],
      [keyword('message'), 'demo']
    ]);
    const cellEntry = {
      source: '...',
      uri: 'cell-1',
      ast: null,
      result: makeErrorValue(errorDescriptor),
      error: null,
      envAfterCell: new Map()
    };
    const cliOutcome = renderCellOutcome(cellEntry);
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toMatch(/^!\{/);
    expect(cliOutcome.stderrText).toMatch(/FilterSubjectNotVec/);
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('routes a success-track value onto stdout with exit 0', async () => {
    const session = await createSession();
    const cellEntry = await session.evalCell('[1 2 3] | count');
    const cliOutcome = renderCellOutcome(cellEntry);
    expect(cliOutcome.stdoutText).toBe('3\n');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

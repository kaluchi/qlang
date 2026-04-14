// render branch coverage. renderCellOutcome decides only the exit
// code and the optional stderr surfacing for host-level JS throws.
// I/O bytes from `@out` / `@err` / `@tap` happen during eval and
// are not this module's concern.

import { describe, it, expect } from 'vitest';
import { renderCellOutcome } from '../src/render.mjs';
import { makeErrorValue, keyword } from '@kaluchi/qlang-core';

describe('renderCellOutcome', () => {
  it('routes a thrown setup-time JS error onto stderr with exit 1', () => {
    const cellEntry = {
      source: 'broken',
      uri: 'cell-1',
      ast: null,
      result: null,
      error: new Error('parse blew up'),
      envAfterCell: new Map()
    };
    const cliOutcome = renderCellOutcome(cellEntry);
    expect(cliOutcome.stderrText).toBe('qlang: parse blew up\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits 1 silently for an unhandled fail-track error value', () => {
    const errorDescriptor = new Map([
      [keyword('thrown'), keyword('FilterSubjectNotVec')]
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
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits 0 silently for a success-track value', () => {
    const cellEntry = {
      source: '"hello"',
      uri: 'cell-1',
      ast: null,
      result: 'hello',
      error: null,
      envAfterCell: new Map()
    };
    const cliOutcome = renderCellOutcome(cellEntry);
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

// render branch coverage. `renderCellOutcome` turns a cell entry
// plus the script-mode context (resolvedFormat + didExplicitStdout
// flag) into the stdoutText / stderrText / exitCode triple the
// orchestrator emits.

import { describe, it, expect } from 'vitest';
import { renderCellOutcome } from '../src/render.mjs';
import { makeErrorValue, keyword } from '@kaluchi/qlang-core';

function makeCellEntry({ result = null, error = null } = {}) {
  return {
    source: '…',
    uri: 'cell-1',
    ast: null,
    result,
    error,
    envAfterCell: new Map()
  };
}

describe('renderCellOutcome — error paths', () => {
  it('routes a thrown setup-time JS error onto stderr with exit 1', () => {
    const cellEntry = makeCellEntry({ error: new Error('parse blew up') });
    const cliOutcome = renderCellOutcome(cellEntry, {
      resolvedFormat: 'raw',
      didExplicitStdoutEffect: false
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('qlang: parse blew up\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits 1 silently for an unhandled fail-track error value', () => {
    const errorDescriptor = new Map([
      [keyword('thrown'), keyword('FilterSubjectNotContainer')]
    ]);
    const cellEntry = makeCellEntry({ result: makeErrorValue(errorDescriptor) });
    const cliOutcome = renderCellOutcome(cellEntry, {
      resolvedFormat: 'raw',
      didExplicitStdoutEffect: false
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });
});

describe('renderCellOutcome — script-mode encoding', () => {
  it('encodes a Map success value as pretty JSON when format is json', () => {
    const result = new Map([
      [keyword('a'), 1],
      [keyword('b'), 'two']
    ]);
    const cliOutcome = renderCellOutcome(makeCellEntry({ result }), {
      resolvedFormat: 'json',
      didExplicitStdoutEffect: false
    });
    expect(cliOutcome.stdoutText).toBe('{\n  "a": 1,\n  "b": "two"\n}\n');
    expect(cliOutcome.exitCode).toBe(0);
  });

  it('passes a String success value through raw (no quotes) when format is raw', () => {
    const cliOutcome = renderCellOutcome(
      makeCellEntry({ result: 'hello world' }),
      { resolvedFormat: 'raw', didExplicitStdoutEffect: false }
    );
    expect(cliOutcome.stdoutText).toBe('hello world\n');
  });

  it('falls back to printValue for a non-String composite in raw mode', () => {
    // Raw input but the query produced a Map — no natural raw form;
    // printValue renders the qlang literal so the user still sees
    // something structural.
    const result = new Map([[keyword('k'), 1]]);
    const cliOutcome = renderCellOutcome(makeCellEntry({ result }), {
      resolvedFormat: 'raw',
      didExplicitStdoutEffect: false
    });
    expect(cliOutcome.stdoutText).toBe('{:k 1}\n');
  });

  it('suppresses the auto-encoded stdout when the query wrote to `@out`', () => {
    const cliOutcome = renderCellOutcome(
      makeCellEntry({ result: 'hello' }),
      { resolvedFormat: 'raw', didExplicitStdoutEffect: true }
    );
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

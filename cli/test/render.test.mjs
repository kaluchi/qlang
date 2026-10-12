// render branch coverage. `renderCellOutcome` turns a cell entry
// plus the script-mode context (the didExplicitStdout flag and the
// colour) into the stdoutText / stderrText / exitCode triple the
// orchestrator emits.

import { describe, it, expect } from 'vitest';
import { renderCellOutcome } from '../src/render.mjs';
import { makeErrorValue, keyword, makeTag } from '@kaluchi/qlang-core';

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
  it('routes a thrown setup-time JS error onto stderr with exit 1', async () => {
    const cellEntry = makeCellEntry({ error: new Error('parse blew up') });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('qlang: parse blew up\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('encodes a fail-track error value as data on stdout, exit 0', async () => {
    // Error values are first-class qlang values per the spec — they
    // travel as data on the same channel as plain values. A non-zero
    // exit on a fail-track result would cancel sibling tool calls in
    // agent harnesses that parallelise qlang invocations.
    const errorDescriptor = new Map([
      ['thrown', keyword('FilterSubjectNotContainerError')]
    ]);
    const cellEntry = makeCellEntry({
      result: makeErrorValue(makeTag('FilterSubjectNotContainerError'), errorDescriptor)
    });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toContain('::FilterSubjectNotContainerError');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

// The answer is written as the language prints it, a string as its text
// [D214].
describe('renderCellOutcome — script-mode encoding', () => {
  it('passes a String success value through as its text', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: 'hello world' }),
      { didExplicitStdoutEffect: false, shouldColorize: false }
    );
    expect(cliOutcome.stdoutText).toBe('hello world\n');
  });

  it('prints a non-String composite as its literal', async () => {
    const result = new Map([['k', 1]]);
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('{:k 1}\n');
    expect(cliOutcome.exitCode).toBe(0);
  });

  it('suppresses the auto-encoded stdout when the query wrote to `out`', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: 'hello' }),
      { didExplicitStdoutEffect: true, shouldColorize: false }
    );
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('renderCellOutcome — ANSI colour when shouldColorize is true', () => {
  it('wraps a printValue success output in ANSI escapes when shouldColorize is true', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: new Map([['k', 1]]) }),
      { didExplicitStdoutEffect: false, shouldColorize: true }
    );
    // ANSI escape pattern present
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(cliOutcome.stdoutText).toMatch(/\x1b\[/);
    // Underlying text content survives stripping
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte at the head of every ANSI SGR sequence
    expect(cliOutcome.stdoutText.replace(/\x1b\[[0-9;]*m/g, '')).toContain('{:k 1}');
  });

  it('paints the failure of a query that does not parse in ANSI on stdout, exit 0 [D232]', async () => {
    const errorDescriptor = new Map([
      ['thrown', keyword('FilterSubjectNotContainerError')]
    ]);
    const cellEntry = makeCellEntry({
      result: makeErrorValue(makeTag('FilterSubjectNotContainerError'), errorDescriptor),
      error: new Error('lifted parse failure')
    });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      didExplicitStdoutEffect: false,
      shouldColorize: true
    });
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(cliOutcome.stdoutText).toMatch(/\x1b\[/);
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

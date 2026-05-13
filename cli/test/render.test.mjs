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
  it('routes a thrown setup-time JS error onto stderr with exit 1', async () => {
    const cellEntry = makeCellEntry({ error: new Error('parse blew up') });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      resolvedFormat: 'raw',
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
    const cellEntry = makeCellEntry({ result: makeErrorValue(errorDescriptor) });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      resolvedFormat: 'raw',
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toContain(':FilterSubjectNotContainerError');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('renderCellOutcome — script-mode encoding', () => {
  it('encodes a Map success value as pretty JSON when format is json', async () => {
    const result = new Map([
      ['a', 1],
      ['b', 'two']
    ]);
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result }), {
      resolvedFormat: 'json',
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('{\n  "a": 1,\n  "b": "two"\n}\n');
    expect(cliOutcome.exitCode).toBe(0);
  });

  it('passes a String success value through raw (no quotes) when format is raw', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: 'hello world' }),
      { resolvedFormat: 'raw', didExplicitStdoutEffect: false, shouldColorize: false }
    );
    expect(cliOutcome.stdoutText).toBe('hello world\n');
  });

  it('falls back to printValue for a non-String composite in raw mode', async () => {
    // Raw input but the query produced a Map — no natural raw form;
    // printValue renders the qlang literal so the user still sees
    // something structural.
    const result = new Map([['k', 1]]);
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result }), {
      resolvedFormat: 'raw',
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('{:k 1}\n');
  });

  it('suppresses the auto-encoded stdout when the query wrote to ~{@out}', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: 'hello' }),
      { resolvedFormat: 'raw', didExplicitStdoutEffect: true, shouldColorize: false }
    );
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('renderCellOutcome — ANSI colour when shouldColorize is true', () => {
  it('wraps a printValue success output (raw format) in ANSI escapes when shouldColorize is true', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: new Map([['k', 1]]) }),
      { resolvedFormat: 'raw', didExplicitStdoutEffect: false, shouldColorize: true }
    );
    // ANSI escape pattern present
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(cliOutcome.stdoutText).toMatch(/\x1b\[/);
    // Underlying text content survives stripping
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte at the head of every ANSI SGR sequence
    expect(cliOutcome.stdoutText.replace(/\x1b\[[0-9;]*m/g, '')).toContain('{:k 1}');
  });

  it('leaves a JSON success output unpainted even when shouldColorize is true', async () => {
    // JSON output must stay clean for `jq` / downstream readers.
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: new Map([['a', 1]]) }),
      { resolvedFormat: 'json', didExplicitStdoutEffect: false, shouldColorize: true }
    );
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(cliOutcome.stdoutText).not.toMatch(/\x1b\[/);
  });

  it('paints a fail-track error value in ANSI when shouldColorize is true', async () => {
    const errorDescriptor = new Map([
      ['thrown', keyword('FilterSubjectNotContainerError')]
    ]);
    const cellEntry = makeCellEntry({
      result: makeErrorValue(errorDescriptor),
      error: new Error('lifted parse failure')
    });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      resolvedFormat: 'raw',
      didExplicitStdoutEffect: false,
      shouldColorize: true
    });
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(cliOutcome.stderrText).toMatch(/\x1b\[/);
  });
});

// render branch coverage. `renderCellOutcome` turns a cell entry plus the
// context of the run (the didExplicitStdout flag and the colour) into the
// stdoutText / stderrText / exitCode triple the orchestrator emits, and
// `answerText` writes the answer as the language prints it, whatever the
// data was [QSHST#answer].

import { describe, it, expect } from 'vitest';
import { renderCellOutcome, answerText } from '../src/render.mjs';
import { liftStdinToPipeValue } from '../src/stdin.mjs';
import { makeErrorValue, keyword, makeTag, langRuntime, evalQuery } from '@kaluchi/qlang-core';

function makeCellEntry({ result = null, defect = null } = {}) {
  return {
    source: '…',
    uri: 'cell-1',
    result,
    defect,
    scopeAfterCell: new Map()
  };
}

describe('renderCellOutcome — error paths', () => {
  it('writes a defect raised past the fail track on stderr as `qlang:` and its message, with exit 1 [QSHST#answer]', async () => {
    const cellEntry = makeCellEntry({ defect: new Error('the host broke') });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('qlang: the host broke\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('writes a defect the printer raises on the answer on stderr as `qlang:` and its message, with exit 1 [QSHST#answer]', async () => {
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result: Infinity }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome).toEqual({ stdoutText: '', stderrText: 'qlang: the core met number Infinity, a value of no kind of the language\n', exitCode: 1 });
  });

  it('encodes a fail-track error value as data on stdout, exit 0', async () => {
    // An error at rest is a value of the language: it travels as data
    // on the same channel as any value. A non-zero
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

// `--fail` gives a failure the code 1 for a script that tests it, the
// failure written as without it [QSHST#answer].
describe('renderCellOutcome — the code a failure exits with', () => {
  const failure = () => makeErrorValue(makeTag('FilterSubjectNotContainerError'), new Map([['thrown', keyword('FilterSubjectNotContainerError')]]));

  it('exits a failure with the code the caller asks for, written as without it', async () => {
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result: failure() }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toContain('::FilterSubjectNotContainerError');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits a failure the query left unwritten by `out` with that code too', async () => {
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result: failure() }), {
      didExplicitStdoutEffect: true,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits a value with 0 whatever code a failure takes', async () => {
    const cliOutcome = await renderCellOutcome(makeCellEntry({ result: 'hello' }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toBe('hello\n');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

// The answer is written as the language prints it, a string as its text
// [QSHST#answer].
describe('renderCellOutcome — the answer as the language prints it', () => {
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
    // The answer holds an ANSI escape.
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(cliOutcome.stdoutText).toMatch(/\x1b\[/);
    // Underlying text content survives stripping
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte at the head of every ANSI SGR sequence
    expect(cliOutcome.stdoutText.replace(/\x1b\[[0-9;]*m/g, '')).toContain('{:k 1}');
  });

  it('writes a string as its text, which no colour paints as code [QSHST#answer]', async () => {
    const cliOutcome = await renderCellOutcome(
      makeCellEntry({ result: 'hello | world' }),
      { didExplicitStdoutEffect: false, shouldColorize: true }
    );
    expect(cliOutcome.stdoutText).toBe('hello | world\n');
  });

  it('paints the failure of a query that does not parse in ANSI on stdout, exit 0 [QSHST#answer]', async () => {
    const cellEntry = makeCellEntry({ result: await evalQuery('[1 2') });
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

// The answer is written as the language prints it whatever the data was,
// a string as its text, so a query converts it where a reader wants
// another format [QSHST#answer].
describe('answerText — the answer as the language prints it', () => {
  it('prints a keyword, a set, a tag and a quote as their literals', async () => {
    expect(await answerText(await evalQuery('[:v #[2 1] ::vec ~(add 1) "s"]'), await langRuntime()))
      .toBe('[:v #[1 2] ::vec ~(add 1) "s"]');
  });

  it('prints a map whose keys a JSON object gave as keywords', async () => {
    expect(await answerText(liftStdinToPipeValue('{"k": 1}', 'auto').pipeValue, await langRuntime())).toBe('{:k 1}');
  });

  it('writes a string as its text, so `| json` writes JSON text', async () => {
    expect(await answerText('hi', await langRuntime())).toBe('hi');
    expect(await answerText(await evalQuery('{:a [1 :k #[2]]} | json'), await langRuntime())).toBe('{"a":[1,"k",[2]]}');
  });

  it('writes a failure as its error at rest under the line that says it was raised, and `!| json` as JSON text [QSERR#rest]', async () => {
    const scope = await langRuntime();
    expect(await answerText(await evalQuery('"x" | add 1'), scope)).toMatch(/^\|~\| raised, and no !\| caught it\n::number\/add\/SubjectNotNumberError!\{[\s\S]*\}$/);
    expect(JSON.parse(await answerText(await evalQuery('"x" | add 1 !| json'), scope)).$tag).toBe('number/add/SubjectNotNumberError');
  });
});

// The command line draws the caret of a refused text below its alert, the
// line within an excerpt around the place, above the prose of the page
// [D393].
describe('answerText — the caret of a refused text', () => {
  const refused = `[${Array.from({ length: 40 }, (_, index) => index + 1).join(' ')}] x`;

  it('writes the caret between the alert and the prose of the page', async () => {
    const text = await answerText(await evalQuery('[1 2'), await langRuntime(), null, 'The page.');
    expect(text).toMatch(/\}\n\|~\| \[1 2\n\|~\| {5}\^\n\|~\| The page\.$/);
  });

  it('draws the caret under the line of a refused text, the line within an excerpt where a budget left it out of the alert [D393]', async () => {
    const failure = await evalQuery(refused);
    expect(await answerText(failure, await langRuntime())).toContain(`}\n|~| ${refused}\n|~| ${' '.repeat(113)}^`);
    const bounded = await answerText(failure, await langRuntime(), 80);
    expect(bounded).toContain(':source ::elision{');
    expect(bounded).toContain(`|~| ${refused}\n|~| ${' '.repeat(113)}^`);
  });
});

// An answer prints within the budget a caller asked for; an error prints as
// its alert [QSHST#answer].
describe('answerText — the budget of the answer', () => {
  const budget = 200;
  const forty = Array.from({ length: 40 }, (_, index) => index + 1);

  it('prints a value past its budget with an elision that reads the rest', async () => {
    const text = await answerText(forty, await langRuntime(), 80);
    expect(text).toContain('::elision{');
    expect(text).toContain(':read ~(drop ');
  });

  it('cuts an error within the budget, the largest of its facts giving way beneath !| [D393]', async () => {
    const failing = await evalQuery(`[{:n 1 :text "${'x'.repeat(200)}"} {:n 2}] | filter ~(nope)`);
    expect(await answerText(failing, await langRuntime(), budget)).toContain(':trace ::elision{:size 2 :read ~(!| get /trace)}');
  });

  it('writes the answer whole when no budget was asked for', async () => {
    const text = await answerText(forty, await langRuntime(), null);
    expect(text).not.toContain('::elision');
  });

  it('writes an error as its alert when no budget was asked for', async () => {
    const failing = await evalQuery(`[${forty.map(index => `{:n ${index}}`).join(' ')}] | filter ~(nope)`);
    expect(await answerText(failing, await langRuntime(), null)).toContain(':read ~(!| get /trace/1/0)');
  });
});

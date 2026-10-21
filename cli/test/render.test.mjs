// What the command line writes for a cell: `renderCellOutcome` turns a cell
// and the context of its run, whether the query wrote by `out`, the colour and
// the code a failure exits with, into what stdout and stderr receive and the
// exit code, and `answerText` writes the answer as the language prints it,
// whatever the data was [QSHST#answer].

import { describe, it, expect } from 'vitest';
import { renderCellOutcome, answerText } from '../src/render.mjs';
import { runQuery } from '../src/run.mjs';
import { silentStreams } from './helpers/silent-streams.mjs';
import { langRuntime, evalQuery, boundAnswer } from '@kaluchi/qlang-core';

// A cell as a session answers it, over the root unless a test hands the scope its query ran in.
async function makeCellEntry({ result = null, defect = null, scope = null } = {}) {
  return {
    source: '…',
    uri: 'cell-1',
    result,
    defect,
    scopeAfterCell: scope ?? await langRuntime()
  };
}

// A failure the language answers, the refusal of `add` on a string.
const refusalOfAdd = () => evalQuery('"x" | add 1');

describe('renderCellOutcome — error paths', () => {
  it('writes a defect raised past the fail track on stderr as `qlang:` and its message, with exit 1 [QSHST#answer]', async () => {
    const cellEntry = await makeCellEntry({ defect: new Error('the host broke') });
    const cliOutcome = await renderCellOutcome(cellEntry, {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.stderrText).toBe('qlang: the host broke\n');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('writes a defect the printer raises on the answer on stderr as `qlang:` and its message, with exit 1 [QSHST#answer]', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: Infinity }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome).toEqual({ stdoutText: '', stderrText: 'qlang: the core met number Infinity, a value of no kind of the language\n', exitCode: 1 });
  });

  it('writes a failure on stdout as every answer, exit 0', async () => {
    // A failure is a value of the language on the channel of every answer with exit 0, so a failing call never stops the calls run beside it [QSHST#answer].
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: await refusalOfAdd() }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toContain('::number/add/SubjectNotNumberError!{');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

// `--fail` gives a failure the code 1 for a script that tests it, the
// failure written as without it [QSHST#answer].
describe('renderCellOutcome — the code a failure exits with', () => {
  it('exits a failure with the code the caller asks for, written as without it', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: await refusalOfAdd() }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toContain('::number/add/SubjectNotNumberError!{');
    expect(cliOutcome.stderrText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits a failure the query left unwritten by `out` with that code too', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: await refusalOfAdd() }), {
      didExplicitStdoutEffect: true,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(1);
  });

  it('exits a value with 0 whatever code a failure takes', async () => {
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result: 'hello' }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false,
      failureExitCode: 1
    });
    expect(cliOutcome.stdoutText).toBe('hello\n');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

// The answer is written as the language prints it [QSHST#answer].
describe('renderCellOutcome — the answer as the language prints it', () => {
  it('prints a non-String composite as its literal', async () => {
    const result = new Map([['k', 1]]);
    const cliOutcome = await renderCellOutcome(await makeCellEntry({ result }), {
      didExplicitStdoutEffect: false,
      shouldColorize: false
    });
    expect(cliOutcome.stdoutText).toBe('{:k 1}\n');
    expect(cliOutcome.exitCode).toBe(0);
  });

  it('writes no answer for a query that wrote by `out`, which holds the channel', async () => {
    const cliOutcome = await renderCellOutcome(
      await makeCellEntry({ result: 'hello' }),
      { didExplicitStdoutEffect: true, shouldColorize: false }
    );
    expect(cliOutcome.stdoutText).toBe('');
    expect(cliOutcome.exitCode).toBe(0);
  });
});

describe('renderCellOutcome — ANSI colour when shouldColorize is true', () => {
  it('paints the literal of an answer in ANSI where the caller asks for colour', async () => {
    const cliOutcome = await renderCellOutcome(
      await makeCellEntry({ result: new Map([['k', 1]]) }),
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
      await makeCellEntry({ result: 'hello | world' }),
      { didExplicitStdoutEffect: false, shouldColorize: true }
    );
    expect(cliOutcome.stdoutText).toBe('hello | world\n');
  });

  it('paints the failure of a query that does not parse in ANSI on stdout, exit 0 [QSHST#answer]', async () => {
    const cellEntry = await makeCellEntry({ result: await evalQuery('[1 2') });
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
// [QSERR#print].
describe('answerText — the caret of a refused text', () => {
  const refused = `[${Array.from({ length: 120 }, (_, index) => index + 1).join(' ')}] x`;

  it('writes the caret between the alert and the prose of the page', async () => {
    const text = await answerText(await evalQuery('[1 2'), await langRuntime(), 'The page.');
    expect(text).toMatch(/\}\n\|~\| \[1 2\n\|~\| {5}\^\n\|~\| The page\.$/);
  });

  it('draws the caret under the line of a refused text, the line within an excerpt where the alert left it out [QSERR#print]', async () => {
    const text = await answerText(await evalQuery(refused), await langRuntime());
    expect(text).toContain(':source ::elision{');
    expect(text).toMatch(/\n\|~\| …[\d ]*\] x\n\|~\| +\^$/);
  });
});

// Every answer prints within one budget: an answer whose print fits prints
// whole, one past it as the refusal in its place, and a failure as its alert
// within the budget [D397].
describe('answerText — the bound of the answer', () => {
  const forty = Array.from({ length: 40 }, (_, index) => index + 1);
  const past = '3000 | range | map ~(get {:id ~(it) :name "user"})';

  it('writes an answer whose print fits the budget whole', async () => {
    expect(await answerText(forty, await langRuntime())).toBe(`[${forty.join(' ')}]`);
  });

  it('writes the first screen whole, the budget never smaller than it', async () => {
    const cellEntry = await runQuery('[::qlang ::cli] | map ~(get [~(it) ~(doc)])', silentStreams);
    expect(await boundAnswer(cellEntry.result, cellEntry.scopeAfterCell)).toBe(cellEntry.result);
  });

  it('writes an answer past the budget as the refusal, its head read from the answer, above the prose of its page', async () => {
    const scope = await langRuntime();
    const text = await answerText(await evalQuery(past, scope), scope);
    expect(text).toMatch(/^\|~\| raised, and no !\| caught it\n::qlang\/AnswerBeyondBudgetError!\{\n {2}:characters 70891\n {2}:budget 16000\n {2}:actualType ::vec\n {2}:actualValue \[\{:id 0 :name "user"\}/);
    expect(text).toMatch(/::elision\{:size \d+ :read ~\(drop \d+\)\}\]\n\}\n\|~\| /);
    expect(text).toContain('print | out');
  });

  it('writes a string past the budget as the refusal, the text it writes measured', async () => {
    const scope = await langRuntime();
    expect(await answerText('x'.repeat(16000), scope)).toBe('x'.repeat(16000));
    expect(await answerText('x'.repeat(16001), scope)).toContain(':characters 16001');
  });

  it('cuts the alert of a failure within the budget, its trace kept to its first frames', async () => {
    const scope = await langRuntime();
    const text = await answerText(await evalQuery(':number/inf ~(add 1 | inf) | 0 | inf', scope), scope);
    expect(text).toContain(':read ~(!| get /trace | drop ');
  });

  it('writes a failure whose alert passes the budget as the refusal above the prose of the refusal\'s page', async () => {
    const scope = await langRuntime();
    const failure = await evalQuery('3000 | range | map ~(get [~(toString | append "k" | toKeyword) ~(it)]) | toMap | raise', scope);
    const text = await answerText(failure, scope, 'The page of the failure.');
    expect([text.includes('::qlang/AnswerBeyondBudgetError!{'), text.includes('print | out'), text.includes('The page of the failure.')]).toEqual([true, true, false]);
  });
});

describe('renderCellOutcome — the bound of the answer [D397]', () => {
  const past = '3000 | range | map ~(get {:id ~(it) :name "user"})';

  it('exits an answer past the budget as every failure exits, with the code the caller asks for', async () => {
    const scope = await langRuntime();
    const cellEntry = await makeCellEntry({ result: await evalQuery(past, scope), scope });
    expect((await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: false, shouldColorize: false })).exitCode).toBe(0);
    const failing = await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: false, shouldColorize: false, failureExitCode: 1 });
    expect([failing.exitCode, failing.stdoutText.includes('::qlang/AnswerBeyondBudgetError')]).toEqual([1, true]);
  });

  it('paints a string past the budget as the alert of its refusal, which is code', async () => {
    const cellEntry = await makeCellEntry({ result: 'x'.repeat(16001) });
    const painted = await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: false, shouldColorize: true });
    // eslint-disable-next-line no-control-regex -- matches the literal ESC byte that ANSI escape sequences open with
    expect(painted.stdoutText).toMatch(/\x1b\[/);
  });

  it('writes nothing and raises no refusal for a query that wrote by out, its code the one its answer exits with', async () => {
    const scope = await langRuntime();
    const cellEntry = await makeCellEntry({ result: await evalQuery(past, scope), scope });
    expect(await renderCellOutcome(cellEntry, { didExplicitStdoutEffect: true, shouldColorize: false, failureExitCode: 1 })).toEqual({ stdoutText: '', stderrText: '', exitCode: 0 });
  });
});

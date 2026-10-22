import { describe, it, expect } from 'vitest';
import { runRepl } from '../../src/repl.mjs';
import { captureRepl, stripAnsi } from '../helpers/scripted-repl.mjs';

describe('the commands of the REPL', () => {
  it('lists the commands of the REPL on `.help`, runs the cell after it and closes at the end of its input', async () => {
    const replHarness = captureRepl('.help\n[1 2] | count\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
    expect(stripAnsi(replHarness.stdoutText())).toMatch(/^qlang> Meta commands:[\s\S]*\.exit[\s\S]*\nqlang> 2\nqlang> $/);
  });

  it('prompts again on an empty line, which runs no cell', async () => {
    const replHarness = captureRepl('\n\n.exit\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
    expect(stripAnsi(replHarness.stdoutText())).toBe('qlang> qlang> qlang> ');
    expect(replHarness.stderrText()).toBe('');
  });
});

describe('a cell run in one session', () => {
  it('starts every cell from the noun of the language, `::qlang`', async () => {
    const replHarness = captureRepl('42\neq ::qlang\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toBe('qlang> 42\nqlang> true\nqlang> ');
  });

  it('preserves bindings between cells within the same session', async () => {
    const replHarness = captureRepl(':any/double ~(mul 2)\n10 | double\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toMatch(/20/);
  });

  it('prints a failed cell on stdout as every answer, exit 0 on close', async () => {
    const replHarness = captureRepl('[1 2 3] | add 1\n.exit\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
    expect(stripAnsi(replHarness.stdoutText())).toMatch(/!\{/);
    expect(replHarness.stderrText()).toBe('');
  });

  it('prints the trace of an error in its display without explicit !|', async () => {
    const replHarness = captureRepl('"hello" | add 1 | mul 2 | sub 3\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const text = stripAnsi(replHarness.stdoutText());
    expect(text).toMatch(/:trace/);
    expect(text).toMatch(/mul/);
    expect(text).toMatch(/sub/);
  });

  it('prints a cell that does not parse as its ::quote/ParseError!{…} on stdout, its caret drawn below it', async () => {
    const replHarness = captureRepl('[1 2\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const text = replHarness.stdoutText().replace(/\x1b\[[0-9;]*m/g, '');
    expect(text).toContain('::quote/ParseError!{');
    expect(text).toContain(':source "[1 2"');
    expect(text).toContain('}\n|~| [1 2\n|~|     ^\n');
    expect(replHarness.stderrText()).toBe('');
  });
});

it('translates `\\n` into `\\r\\n` for the writes of a terminal, a failed cell on stdout and `err` on stderr', async () => {
  const ttyStdin = new (await import('node:stream')).PassThrough();
  ttyStdin.isTTY = true;
  ttyStdin.setRawMode = () => {};

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutWrite = (text) => stdoutChunks.push(text);
  const stderrWrite = (text) => stderrChunks.push(text);

  const replPromise = runRepl(ttyStdin, stdoutWrite, stderrWrite, { terminal: ttyStdin });
  ttyStdin.write(Buffer.from('[1 2\r'));
  await new Promise((resolveTick) => setImmediate(resolveTick));
  ttyStdin.write(Buffer.from('"one\\ntwo" | err\r'));
  await new Promise((resolveTick) => setImmediate(resolveTick));
  ttyStdin.write(Buffer.from([0x04]));
  await replPromise;

  expect(stdoutChunks.join('').replace(/\x1b\[[0-9;]*m/g, '')).toContain('caught it\r\n::quote/ParseError!{');
  expect(stderrChunks.join('')).toContain('one\r\ntwo');
});

it('writes the defect of a cell on stderr as `qlang:` and its message, and runs the next cell', async () => {
  const deep = '['.repeat(20000) + ']'.repeat(20000);
  const replHarness = captureRepl(`${deep}\n[1 2] | count\n.exit\n`);
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  expect(replHarness.stderrText()).toBe('qlang: Maximum call stack size exceeded\n');
  expect(stripAnsi(replHarness.stdoutText())).toContain('2\n');
});

it('prints a failure with the steps its trace holds, the steps it skipped among them', async () => {
  // [QSERR#trace]
  const query = '!{:kind :first} | raise | count !| union {:k 1} | raise | add 1 | mul 2';
  const replHarness = captureRepl(query + '\n.exit\n');
  const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
  expect(exitCode).toBe(0);
  const out = stripAnsi(replHarness.stdoutText());
  expect(out).toMatch(/count/);
  expect(out).toMatch(/add 1/);
  expect(out).toMatch(/mul 2/);
});

it('runs the query given on the command line before the typed cells, in the same session', async () => {
  const replHarness = captureRepl('x | add 1\n.exit\n');
  await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { initialQuery: ':x 41', terminal: replHarness.stdinStream });
  const printed = stripAnsi(replHarness.stdoutText());
  expect(printed).toContain('qlang> :x 41');
  expect(printed).toContain('42');
});

describe('an answer printed whole and a failure as its alert', () => {
  it('prints an answer past the budget whole, its last element among it', async () => {
    const replHarness = captureRepl('3000 | range | map ~(get {:id ~(it) :name "user"})\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain('{:id 2999 :name "user"}]');
    expect(printed).not.toContain('::qlang/AnswerBeyondBudgetError');
  });

  it('prints no value of the answer of a cell that wrote by out, which holds the channel, and a failure after it as its alert', async () => {
    const replHarness = captureRepl('5000 | range | print | out\n"x" | out | add 1\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain('4998 4999]\n');
    expect(printed).not.toContain('::qlang/AnswerBeyondBudgetError');
    expect(printed).toContain('::number/add/SubjectNotNumberError');
  });

  it('prints a failure as its alert, the subject of a frame of its trace cut to an elision whose `:read` reaches it', async () => {
    const records = `[${Array.from({ length: 40 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
    const replHarness = captureRepl(`${records} | filter ~(nope)\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toContain(':read ~(!| get /trace/1/0)');
  });

  it('prints the alert of a runaway recursion within the budget', async () => {
    const replHarness = captureRepl(':number/inf ~(add 1 | inf) | 0 | inf\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toContain(':read ~(!| get /trace | drop ');
  });
});

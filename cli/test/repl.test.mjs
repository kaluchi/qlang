// The REPL driven through its line editor by scripted input, piped and as a
// terminal: its commands `.help` and `.exit`, the answer of each cell printed
// painted on stdout, a failure among them and a defect on stderr, and the
// names a cell declares kept for the cells after it [QSHST#repl].

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { runRepl } from '../src/repl.mjs';

const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE, '');
}

function captureRepl(scriptedInput) {
  const stdinStream = Readable.from([scriptedInput]);
  stdinStream.isTTY = false;

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutWrite = (text) => stdoutChunks.push(text);
  const stderrWrite = (text) => stderrChunks.push(text);

  return {
    stdinStream,
    stdoutWrite,
    stderrWrite,
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

describe('runRepl — meta commands', () => {
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

describe('runRepl — query evaluation', () => {
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

  it('prints a failed cell on stdout as every answer, exit 0 on close [QSHST#answer]', async () => {
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

  it('reads a doc whose quote stands under the tag of a group as a cell, its answer on stdout and no defect [QSSLF#doc]', async () => {
    const replHarness = captureRepl('|~~ see ::group~(add 1) ~~| | segments | get /1\n["a" ::group~(x)] | tag ::doc | :d it | print | parse | first | eq d\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toBe('qlang> ::group~(add 1)\nqlang> true\nqlang> ');
    expect(replHarness.stderrText()).toBe('');
  });

  it('prints a cell that does not parse as its ::quote/ParseError!{…} on stdout, its caret drawn below it [QSHST#answer]', async () => {
    const replHarness = captureRepl('[1 2\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    // REPL paints output with ANSI colour codes — strip before
    // matching the text.
    const text = replHarness.stdoutText().replace(/\x1b\[[0-9;]*m/g, '');
    expect(text).toContain('::quote/ParseError!{');
    expect(text).toContain(':source "[1 2"');
    expect(text).toContain('}\n|~| [1 2\n|~|     ^\n');
    expect(replHarness.stderrText()).toBe('');
  });
});

describe('runRepl — output highlighting', () => {
  it('paints the printed result with ANSI escape sequences', async () => {
    const replHarness = captureRepl('[1 2 3]\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    // Numbers render under the yellow escape.
    expect(replHarness.stdoutText()).toMatch(/\x1b\[33m/);
  });

  it('paints the prompt, the name of the language bright white and its angle bold cyan', async () => {
    const replHarness = captureRepl('.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(replHarness.stdoutText()).toMatch(/\x1b\[1;97mqlang/);
    expect(replHarness.stdoutText()).toMatch(/\x1b\[1;36m>/);
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
    // A bare `[1 2` is a parse failure, an answer the REPL prints on
    // stdout, and `err` writes its text on stderr. Enter (CR) is the
    // submit keystroke in the multi-line editor; Ctrl+Enter (LF) would
    // insert a soft newline.
    ttyStdin.write(Buffer.from('[1 2\r'));
    await new Promise((resolveTick) => setImmediate(resolveTick));
    ttyStdin.write(Buffer.from('"one\\ntwo" | err\r'));
    await new Promise((resolveTick) => setImmediate(resolveTick));
    ttyStdin.write(Buffer.from([0x04]));   // Ctrl+D on empty buffer
    await replPromise;

    expect(stdoutChunks.join('').replace(/\x1b\[[0-9;]*m/g, '')).toContain('caught it\r\n::quote/ParseError!{');
    expect(stderrChunks.join('')).toContain('one\r\ntwo');
  });

  it('paints the line as it is typed', async () => {
    // A line typed and discarded by Ctrl+C runs no cell, so the paint of its number is the line editor's alone.
    const ttyStdin = new (await import('node:stream')).PassThrough();
    ttyStdin.isTTY = true;
    ttyStdin.setRawMode = () => {};

    const stdoutChunks = [];
    const replPromise = runRepl(ttyStdin, (text) => stdoutChunks.push(text), () => {}, { terminal: ttyStdin });
    ttyStdin.write(Buffer.from('42'));
    ttyStdin.write(Buffer.from([0x03]));   // Ctrl+C discards the line
    await new Promise((resolveTick) => setImmediate(resolveTick));
    ttyStdin.write(Buffer.from([0x04]));   // Ctrl+D on the empty line closes the REPL
    await replPromise;

    expect(stdoutChunks.join('')).toMatch(/\x1b\[33m42/);
  });
});

// A defect raised past the fail track is no answer: the REPL writes it on
// stderr and runs the next cell [QSHST#repl].
describe('runRepl — a defect of a cell', () => {
  it('writes the defect on stderr as `qlang:` and its message, and runs the next cell', async () => {
    const deep = '['.repeat(20000) + ']'.repeat(20000);
    const replHarness = captureRepl(`${deep}\n[1 2] | count\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(replHarness.stderrText()).toBe('qlang: Maximum call stack size exceeded\n');
    expect(stripAnsi(replHarness.stdoutText())).toContain('2\n');
  });
});

describe('runRepl — the trace of a failure', () => {
  it('prints a failure with the steps its trace holds, the steps it skipped among them', async () => {
    // The trace of an error is written as it flows [QSERR#trace], so the failure a cell answers holds every frame and every step it skipped.
    const query = '!{:kind :first} | raise | count !| union {:k 1} | raise | add 1 | mul 2';
    const replHarness = captureRepl(query + '\n.exit\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
    const out = stripAnsi(replHarness.stdoutText());
    expect(out).toMatch(/count/);
    expect(out).toMatch(/add 1/);
    expect(out).toMatch(/mul 2/);
  });
});

describe('runRepl — in / out behaviour', () => {
  it('answers `in` with the empty string, the prompt holding standard input', async () => {
    const replHarness = captureRepl('in | print | out\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    // `in` answers the empty string, whose literal `""` `print` makes and `out` writes on stdout.
    expect(stripAnsi(replHarness.stdoutText())).toMatch(/""/);
  });
});

// A query given after `-i` runs as the first cell, its bindings staying
// for the cells after it [QSHST#answer].
describe('runRepl — the first cell given on the command line', () => {
  it('runs the query before the typed cells, in the same session', async () => {
    const replHarness = captureRepl('x | add 1\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { initialQuery: ':x 41', terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain('qlang> :x 41');
    expect(printed).toContain('42');
  });
});

// A cell prints within the one budget of every answer, an answer past it as
// the refusal in its place, and an error as its alert within it, without the
// prose of its page [QSHST#repl].
describe('runRepl — the bound of an answer', () => {
  it('prints an answer past the budget as the refusal, without the prose of its page', async () => {
    const replHarness = captureRepl('3000 | range | map ~(get {:id ~(it) :name "user"})\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain('::qlang/AnswerBeyondBudgetError!{');
    expect(printed).toContain(':read ~(drop ');
    expect(printed).not.toContain('print | out');
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

  it('draws the caret below a refused text its alert left out, the line within an excerpt [QSERR#print]', async () => {
    const refused = `[${Array.from({ length: 120 }, (_, index) => index + 1).join(' ')}] x`;
    const replHarness = captureRepl(`${refused}\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain(':source ::elision{');
    expect(printed).toMatch(/\|~\| …[\d ]*\] x\n\|~\| +\^/);
  });
});

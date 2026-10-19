// REPL coverage. Driving readline through synthetic Readable input
// confirms every meta-command branch, the auto-print contract for
// success/error/JS-throw cell outcomes, and the persistence of
// bindings across cells inside one session.

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
  it('closes on `.exit` and resolves to exit code 0', async () => {
    const replHarness = captureRepl('.exit\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
  });

  it('writes the help banner on `.help` and stays open until EOF', async () => {
    const replHarness = captureRepl('.help\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
    expect(replHarness.stdoutText()).toMatch(/Meta commands:/);
    expect(replHarness.stdoutText()).toMatch(/\.exit/);
  });

  it('skips empty lines and reprompts without evaluating', async () => {
    const replHarness = captureRepl('\n\n.exit\n');
    const exitCode = await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(exitCode).toBe(0);
    expect(replHarness.stderrText()).toBe('');
  });
});

describe('runRepl — query evaluation', () => {
  it('auto-prints the success-track value of a single cell', async () => {
    const replHarness = captureRepl('[1 2 3] | count\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toMatch(/3/);
  });

  it('starts every cell from the default subject', async () => {
    const replHarness = captureRepl('type\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toMatch(/::tag/);
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

  it('paints the prompt with bright-white name + bold-cyan angle on every line', async () => {
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

    const stdoutText = stdoutChunks.join('');
    expect(stdoutText.replace(/\x1b\[[0-9;]*m/g, '')).toContain('::quote/ParseError!{');
    expect(stdoutText).toMatch(/\r\n/);
    expect(stderrChunks.join('')).toContain('one\r\ntwo');
  });

  it('exercises the per-keystroke render callback in TTY mode', async () => {
    // Drive the editor in TTY mode so its raw-mode redraw path
    // calls into the REPL's render callback (which paints the
    // current buffer through highlightAnsi). Every visible
    // keystroke should leave a yellow-number escape behind in
    // stdout — the only way that escape can appear before Enter
    // is via the live-render hook.
    const ttyStdin = new (await import('node:stream')).PassThrough();
    ttyStdin.isTTY = true;
    ttyStdin.setRawMode = () => {};

    const stdoutChunks = [];
    const stderrChunks = [];
    const stdoutWrite = (text) => stdoutChunks.push(text);
    const stderrWrite = (text) => stderrChunks.push(text);

    const replPromise = runRepl(ttyStdin, stdoutWrite, stderrWrite, { terminal: ttyStdin });
    // Type "42", which should redraw with the yellow escape, then
    // submit with Enter (CR), then close on Ctrl+D from an empty
    // buffer.
    ttyStdin.write(Buffer.from('42'));
    ttyStdin.write(Buffer.from('\r'));
    await new Promise((resolveTick) => setImmediate(resolveTick));
    ttyStdin.write(Buffer.from([0x04])); // Ctrl+D on empty buffer
    await replPromise;

    const stdoutText = stdoutChunks.join('');
    expect(stdoutText).toMatch(/\x1b\[33m4/);
  });
});

// A defect raised past the fail track is no answer: the REPL writes it on
// stderr and runs the next cell [QSHST#repl].
describe('runRepl — a defect of a cell', () => {
  it('writes the defect on stderr as `qlang:` and its message, and runs the next cell', async () => {
    const leaked = '1e308 | apply (::fn | takes :x |~~ An x. ~~| /0 | impl (::number/add | binding | get /value | get /1)) [1e308] | print';
    const replHarness = captureRepl(`${leaked}\n[1 2] | count\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(replHarness.stderrText()).toBe('qlang: the core met number Infinity, a value of no kind of the language\n');
    expect(stripAnsi(replHarness.stdoutText())).toContain('2\n');
  });

  it('writes a defect the printer raises on the answer on stderr, and runs the next cell', async () => {
    const leaked = '1e308 | apply (::fn | takes :x |~~ An x. ~~| /0 | impl (::number/add | binding | get /value | get /1)) [1e308]';
    const replHarness = captureRepl(`${leaked}\n[1 2] | count\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(replHarness.stderrText()).toBe('qlang: the core met number Infinity, a value of no kind of the language\n');
    expect(stripAnsi(replHarness.stdoutText())).toContain('2\n');
  });
});

describe('runRepl — error rendering', () => {
  it('renders an error value with its trace through the same printValue path as success values', async () => {
    // The trace of an error is written as it flows [QSERR#trace], so the value
    // the cell answers already holds every frame and every skipped
    // step. The REPL renders the value verbatim through `printValue`.
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
  it('binds `in` to return the empty String so the cell does not deadlock against the prompt', async () => {
    const replHarness = captureRepl('in | print | out\n.exit\n');
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    // `in` resolves to ''. print renders it as the qlang String
    // literal `""`. out writes that to stdout, then the REPL
    // auto-prints the cell's success-track value (also `""`). The
    // captured output therefore contains the empty-String literal.
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

// A cell prints within the budget a caller asked for, an error among
// them, and an error as its alert when none is [QSHST#answer].
describe('runRepl — the budget of an answer', () => {
  const forty = `[${Array.from({ length: 40 }, (_, index) => index + 1).join(' ')}]`;

  it('prints a value past its budget with an elision that reads the rest', async () => {
    const replHarness = captureRepl(`${forty}\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { budget: 80, terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toContain('::elision{');
  });

  it('prints an error as its alert when no budget was asked for', async () => {
    const records = `[${Array.from({ length: 40 }, (_, index) => `{:n ${index}}`).join(' ')}]`;
    const replHarness = captureRepl(`${records} | filter ~(nope)\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toContain(':read ~(!| get /trace/1/0)');
  });

  it('prints an error within the budget', async () => {
    const replHarness = captureRepl(`${forty} | filter ~(nope)\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { budget: 200, terminal: replHarness.stdinStream });
    expect(stripAnsi(replHarness.stdoutText())).toContain(':read ~(!| get /trace/');
  });

  it('draws no caret where the budget left the line of a refused text out of its alert [QSHST#answer]', async () => {
    const replHarness = captureRepl(`${forty} x\n.exit\n`);
    await runRepl(replHarness.stdinStream, replHarness.stdoutWrite, replHarness.stderrWrite, { budget: 80, terminal: replHarness.stdinStream });
    const printed = stripAnsi(replHarness.stdoutText());
    expect(printed).toContain(':source ::elision{');
    expect(printed).not.toContain('|~| [1 2');
  });
});

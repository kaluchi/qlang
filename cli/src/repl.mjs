// readline-based REPL for the qlang CLI. One persistent session
// across the whole loop — every line evaluates inside the same env,
// so `let(:x, 42)` followed later by `x | pretty | @out` works
// across cells.
//
// Output is highlighted via the same AST tokenizer the site uses,
// painted with terminal ANSI escapes from highlight-ansi.mjs.
// Input echoes through readline as plain text — live-typing colour
// would need raw mode and per-keystroke redraw, deferred for now;
// the post-eval result line is highlighted, the keyboard-line is
// left to the terminal's own echo.
//
// Contract differences from the script-mode runner:
//   * Each cell's success-track value auto-prints (printValue +
//     ANSI), the way every interactive REPL surfaces results;
//     script mode stays silent without `@out` by design.
//   * `@in` resolves to the empty String — interactive stdin is
//     consumed by the prompt itself, so reading "stdin" from
//     inside a cell would deadlock against the line reader.
//   * `@out` / `@err` / `@tap` keep their normal contracts; their
//     side-effects appear before the auto-printed result line.
//
// Meta commands (single dot prefix, exact match):
//   .help    list meta commands
//   .exit    close the REPL (Ctrl+D produces the same effect)

import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { createSession } from '@kaluchi/qlang-core/session';
import {
  printValue,
  isErrorValue,
  langRuntime
} from '@kaluchi/qlang-core';
import { bindIoOperands } from './io-operands.mjs';
import { bindFormatOperands } from './format-operands.mjs';
import { bindParseOperands } from './parse-operands.mjs';
import { highlightAnsi } from './highlight-ansi.mjs';

const PROMPT = '\x1b[1;36mqlang>\x1b[0m ';

const REPL_HELP = `Meta commands:
  .help    list meta commands
  .exit    close the REPL (Ctrl+D works too)

Type a qlang query and press Enter to evaluate. Bindings introduced
with let / as persist across cells within the same REPL session.
`;

export async function runRepl(stdinStream, stdoutWrite, stderrWrite) {
  const builtinNames = new Set(
    [...(await langRuntime()).keys()].map((k) => k.name)
  );

  const session = await createSession();
  bindIoOperands(session, {
    stdinReader: () => Promise.resolve(''),
    stdoutWrite,
    stderrWrite
  });
  bindFormatOperands(session);
  bindParseOperands(session);

  // readline expects a Writable stream, not a write callback;
  // wrap stdoutWrite so prompt echo and history scrolling reach
  // the same destination as cell results.
  const stdoutStream = new Writable({
    write(chunk, _encoding, callback) {
      stdoutWrite(chunk.toString());
      callback();
    }
  });

  const lineReader = createInterface({
    input:        stdinStream,
    output:       stdoutStream,
    prompt:       PROMPT,
    historySize:  1000,
    terminal:     stdinStream.isTTY === true
  });

  // readline's 'line' event fires synchronously per `\n` it sees,
  // but our handler is async (evalCell awaits the chain). Without
  // serialisation a piped multi-line input would race: 'close'
  // fires before earlier evals finish, the runRepl Promise resolves
  // too early, and tests see only the first prompt. Chain every
  // line through one in-flight Promise so order is deterministic
  // and 'close' waits for the queue to drain.
  return new Promise((resolve) => {
    let lineQueue = Promise.resolve();

    lineReader.on('line', (rawLine) => {
      lineQueue = lineQueue.then(() => handleLine(rawLine));
    });

    lineReader.on('close', () => {
      lineQueue.then(() => resolve(0));
    });

    lineReader.prompt();

    async function handleLine(rawLine) {
      const line = rawLine.trim();

      if (line === '') {
        lineReader.prompt();
        return;
      }
      if (line === '.exit') {
        lineReader.close();
        return;
      }
      if (line === '.help') {
        stdoutWrite(REPL_HELP);
        lineReader.prompt();
        return;
      }

      const cellEntry = await session.evalCell(rawLine);
      writeCellOutcome(cellEntry, builtinNames, stdoutWrite, stderrWrite);
      lineReader.prompt();
    }
  });
}

function writeCellOutcome(cellEntry, builtinNames, stdoutWrite, stderrWrite) {
  if (cellEntry.error !== null) {
    stderrWrite(`error: ${cellEntry.error.message}\n`);
    return;
  }
  const renderedValue = highlightAnsi(printValue(cellEntry.result), builtinNames);
  if (isErrorValue(cellEntry.result)) {
    stderrWrite(renderedValue + '\n');
    return;
  }
  stdoutWrite(renderedValue + '\n');
}

// REPL for the qlang CLI. Persistent session across cells —
// `let(:x, 42)` followed later by `x | pretty | @out` works inside
// one session.
//
// Built on `cli/src/line-editor.mjs`:
//   * In a real terminal: raw-mode keystroke capture, every byte
//     re-renders the current line through `highlightAnsi` so input
//     paints live as the user types; bracketed-paste support means
//     a multi-line JSON paste lands as ONE cell instead of N
//     parse failures; cursor motion (Left/Right/Home/End/Ctrl+A/E)
//     and Backspace/Delete-forward all work.
//   * In a pipe / scripted test: line-buffered passthrough, no
//     escapes, no raw mode — the same handler reads `'line'`
//     events identically.
//
// Contract differences from the script-mode runner:
//   * Each cell's success-track value auto-prints (printValue +
//     ANSI), the way every interactive REPL surfaces results;
//     script mode stays silent without `@out` by design.
//   * `@in` resolves to the empty String — interactive stdin is
//     consumed by the prompt itself, so reading "stdin" from
//     inside a cell would deadlock against the line editor.
//   * `@out` / `@err` / `@tap` keep their normal contracts; their
//     side-effects appear before the auto-printed result line.
//
// Meta commands (single dot prefix, exact match):
//   .help    list meta commands
//   .exit    close the REPL (Ctrl+D on an empty line works too)

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
import { createLineEditor } from './line-editor.mjs';

const PROMPT = '\x1b[1;36mqlang>\x1b[0m ';

const REPL_HELP = `Meta commands:
  .help    list meta commands
  .exit    close the REPL (Ctrl+D on an empty line works too)

Editing:
  Enter               insert a newline (the buffer stays open;
                      multi-line cells are the default)
  Ctrl+Enter / Ctrl+J evaluate the current cell
  Alt+Enter           evaluate the current cell (fallback for
                      terminals that do not distinguish Ctrl+Enter)
  Backspace           delete the character before the cursor
                      (across \`\\n\` if needed — rows collapse)
  Left / Right        move the cursor by one character
  Home / Ctrl+A       jump to the start of the buffer
  End  / Ctrl+E       jump to the end of the buffer
  Up   / Down         walk through the in-memory cell history
  Ctrl+C              discard the current buffer and reprompt

Pasting multi-line text from the clipboard arrives as one cell
with its structure preserved — the editor redraws the pasted
block across as many rows as the content needs, so an appended
projection like \`| /key\` can land on the same cell as the paste.

Bindings introduced with let / as persist across cells within the
same REPL session.
`;

export async function runRepl(stdinStream, stdoutWrite, stderrWrite) {
  const builtinNames = new Set(
    [...(await langRuntime()).keys()].map((k) => k.name)
  );

  // In raw-mode TTY the terminal does not translate `\n` into CRLF
  // — a bare LF moves the cursor down without resetting the
  // column, leaving subsequent output stranded mid-line. Wrap the
  // writers so every `\n` we emit becomes `\r\n` in the
  // interactive case; in non-TTY (pipe / scripted test) the
  // writers stay verbatim so byte-exact assertions still pass.
  const isInteractiveTty = stdinStream.isTTY === true;
  const writeOutput = isInteractiveTty
    ? (text) => stdoutWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stdoutWrite;
  const writeDiagnostic = isInteractiveTty
    ? (text) => stderrWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stderrWrite;

  const session = await createSession();
  bindIoOperands(session, {
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: writeOutput,
    stderrWrite: writeDiagnostic
  });
  bindFormatOperands(session);
  bindParseOperands(session);

  const lineEditor = createLineEditor(stdinStream, stdoutWrite, {
    prompt: PROMPT,
    render: (bufferText) => highlightAnsi(bufferText, builtinNames),
    columns: () => (stdinStream.columns || process.stdout.columns || 80)
  });

  // The editor fires 'line' synchronously per submission, but the
  // handler awaits evalCell. Serialise through one in-flight
  // Promise so order is deterministic and 'close' waits for the
  // queue to drain — otherwise piped multi-line input would race
  // and the runRepl Promise could resolve before earlier evals
  // finished writing their output.
  return new Promise((resolve) => {
    let lineQueue = Promise.resolve();

    lineEditor.on('line', (rawLine) => {
      lineQueue = lineQueue.then(() => handleLine(rawLine));
    });

    lineEditor.on('close', () => {
      lineQueue.then(() => {
        lineEditor.close();
        resolve(0);
      });
    });

    lineEditor.start();
    lineEditor.prompt();

    async function handleLine(rawLine) {
      const line = rawLine.trim();

      if (line === '') {
        lineEditor.prompt();
        return;
      }
      if (line === '.exit') {
        lineEditor.emit('close');
        return;
      }
      if (line === '.help') {
        writeOutput(REPL_HELP);
        lineEditor.prompt();
        return;
      }

      const cellEntry = await session.evalCell(rawLine);
      writeCellOutcome(cellEntry, builtinNames, writeOutput, writeDiagnostic);
      lineEditor.prompt();
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

// The REPL: one session across its cells, each line a cell whose answer
// prints, painted, after what its `out`, `err` and `tap` wrote; in a terminal
// the line paints as it is typed and a paste of several lines is one cell,
// through the line editor; `in` reads the empty string, since the prompt holds
// standard input; a query given after `-i` runs as the first cell
// [QSHST#answer]; `.help` lists the commands of the REPL, and `.exit` or
// Ctrl+D on an empty line closes it.

import { createSession } from '@kaluchi/qlang-core/session';
import {
  printAnswer,
  elideAnswer,
  langRuntime,
  verbNames
} from '@kaluchi/qlang-core';
import { cliSources } from './cli-sources.mjs';
import { DEFAULT_SUBJECT } from './script-mode.mjs';
import { highlightAnsi } from './highlight-ansi.mjs';
import { createLineEditor } from './line-editor.mjs';

const PROMPT = '\x1b[1;97mqlang\x1b[0m\x1b[1;36m>\x1b[0m ';

const REPL_HELP = `Meta commands:
  .help    list meta commands
  .exit    close the REPL (Ctrl+D on an empty line works too)

Editing:
  Enter               evaluate the current cell (PowerShell / bash
                      muscle-memory parity)
  Ctrl+Enter / Ctrl+J insert a soft newline at the cursor — keep
                      composing a multi-line cell
  Alt+Enter           evaluate the current cell (alternate submit
                      for hosts that intercept Ctrl+Enter)
  Backspace           delete the character before the cursor
                      (across \`\\n\` if needed — rows collapse)
  Left / Right        move the cursor by one character
  Home / Ctrl+A       jump to the start of the buffer
  End  / Ctrl+E       jump to the end of the buffer
  Up   / Down         step one logical row inside a multi-line
                      cell; at the top / bottom of the cell walk
                      through the in-memory history, falling back
                      to start / end of buffer once history runs
                      out
  Ctrl+C              discard the current buffer and reprompt

Pasting multi-line text from the clipboard arrives as one cell
with its structure preserved — the editor redraws the pasted
block across as many rows as the content needs, so an appended
step like \`| get /key\` can land on the same cell as the paste.

Names a cell declares, \`:name body\` and \`:name it\` among them,
persist across the cells of one REPL session.
`;

export async function runRepl(stdinStream, stdoutWrite, stderrWrite, { budget = null, initialQuery = null, terminal } = {}) {
  const builtinNames = verbNames(await langRuntime());

  // A terminal in raw mode moves the cursor down at `\n` without
  // returning it, so the writers of a terminal write `\r\n`.
  const isInteractiveTty = stdinStream.isTTY === true;
  const writeOutput = isInteractiveTty
    ? (text) => stdoutWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stdoutWrite;
  const writeDiagnostic = isInteractiveTty
    ? (text) => stderrWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stderrWrite;

  const session = await createSession({
    sources: cliSources({
      stdinReader: () => Promise.resolve(''),
      stdoutWrite: writeOutput,
      stderrWrite: writeDiagnostic
    })
  });

  const lineEditor = createLineEditor(stdinStream, stdoutWrite, {
    prompt: PROMPT,
    render: (bufferText) => highlightAnsi(bufferText, builtinNames),
    columns: () => terminal.columns || 80
  });

  // The cells run one after another, and the REPL closes once the last
  // has written.
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
    if (initialQuery === null) lineEditor.prompt();
    else lineEditor.submit(initialQuery);

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

      const cellEntry = await session.evalCell(rawLine, { initialPipeValue: DEFAULT_SUBJECT });
      await writeCellOutcome(cellEntry, builtinNames, writeOutput, budget);
      lineEditor.prompt();
    }
  });
}

// An answer prints whole, an error as an alert, or within the budget
// the caller asked for, what does not fit given way to markers that read
// it, on stdout: a failed cell, one that does not parse among them, is an
// answer as every failure is [QSHST#answer].
async function writeCellOutcome(cellEntry, builtinNames, stdoutWrite, budget) {
  const shown = elideAnswer(cellEntry.result, budget);
  stdoutWrite(highlightAnsi(await printAnswer(shown, cellEntry.envAfterCell), builtinNames) + '\n');
}

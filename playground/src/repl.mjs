// [QSCLI#repl]

import {
  createNotebook,
  printAnswer,
  boundAnswer,
  isErrorValue,
  langRuntime,
  verbNames
} from '@kaluchi/qlang-core';
import { keepCell } from '@kaluchi/qlang-stdio';
import { playgroundSources } from './playground-sources.mjs';
import { DEFAULT_SUBJECT } from './stdin.mjs';
import { cellText } from './render.mjs';
import { highlightAnsi } from './highlight-ansi.mjs';
import { createLineEditor } from './line-editor.mjs';

const PROMPT = '\x1b[1;97mqplay\x1b[0m\x1b[1;36m>\x1b[0m ';

const REPL_HELP = `Meta commands:
  .help    list meta commands
  .exit    close the REPL (Ctrl+D on an empty line works too)

Editing:
  Enter               evaluate the current cell
  Ctrl+Enter / Ctrl+J insert a soft newline at the cursor — keep
                      composing a multi-line cell
  Alt+Enter           evaluate the current cell
  Backspace           delete the character before the cursor
                      (across \`\\n\` if needed — rows collapse)
  Left / Right        move the cursor by one character
  Home / Ctrl+A       jump to the start of the buffer
  End  / Ctrl+E       jump to the end of the buffer
  Up   / Down         step one row inside a cell of several
                      rows; past its first and its last row move
                      through the cells submitted before
  Ctrl+C              clear the cell and the edits kept in the
                      cells before

Pasting text of several lines from the clipboard lands at the
cursor as one cell, its lines kept.

Names a cell declares, \`:name body;\`, persist across the cells of
one run of the REPL; a value of the subject is named by \`with\`.
`;

export async function runRepl(stdinStream, stdoutWrite, stderrWrite, { initialQuery = null, terminal } = {}) {
  const rootVerbNames = verbNames(await langRuntime());

  const isInteractiveTty = stdinStream.isTTY === true;
  const writeOutput = isInteractiveTty
    ? (text) => stdoutWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stdoutWrite;
  const writeDiagnostic = isInteractiveTty
    ? (text) => stderrWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stderrWrite;

  let wroteByOut = false;
  let runningLine = '';
  const notebook = await createNotebook({
    sources: playgroundSources({
      stdinReader: () => Promise.resolve(''),
      stdoutWrite: writeOutput,
      stderrWrite: writeDiagnostic,
      recordStdoutEffect: () => { wroteByOut = true; },
      get query() { return runningLine; }
    })
  });

  const lineEditor = createLineEditor(stdinStream, stdoutWrite, {
    prompt: PROMPT,
    render: (bufferText) => highlightAnsi(bufferText, rootVerbNames),
    columns: () => terminal.columns || 80
  });

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

      wroteByOut = false;
      runningLine = rawLine;
      const cellEntry = await notebook.evalCell(rawLine, { initialPipeValue: DEFAULT_SUBJECT });
      await writeCellOutcome(cellEntry, rootVerbNames, writeOutput, writeDiagnostic, wroteByOut);
      lineEditor.prompt();
    }
  });
}

async function writeCellOutcome(cellEntry, rootVerbNames, stdoutWrite, stderrWrite, wroteByOut) {
  const { stdoutText, stderrText } = await cellText(cellEntry, async (result, scope) => {
    if (wroteByOut && !isErrorValue(result)) return null;
    const shown = isErrorValue(result) ? await boundAnswer(result, scope, null, value => keepCell({ query: cellEntry.source, scope, value })) : result;
    return await printAnswer(shown, scope);
  });
  if (stderrText !== undefined) stderrWrite(stderrText);
  else if (stdoutText !== null) stdoutWrite(highlightAnsi(stdoutText, rootVerbNames) + '\n');
}

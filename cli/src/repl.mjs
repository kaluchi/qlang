// The REPL: one session across its cells, each line a cell whose answer
// prints, painted, after what its `out`, `err` and `tap` wrote; in a terminal
// the line paints as it is typed and a paste of several lines is one cell,
// through the line editor; `in` reads the empty string, since the prompt holds
// standard input; a query given after `-i` runs as the first cell
// [QSHST#answer]; `.help` lists the commands of the REPL, and `.exit` or
// Ctrl+D on an empty line closes it.

import {
  createSession,
  printAnswer,
  boundAnswer,
  caretOf,
  isErrorValue,
  langRuntime,
  verbNames
} from '@kaluchi/qlang-core';
import { cliSources } from './cli-sources.mjs';
import { DEFAULT_SUBJECT } from './stdin.mjs';
import { cellText } from './render.mjs';
import { highlightAnsi } from './highlight-ansi.mjs';
import { createLineEditor } from './line-editor.mjs';

const PROMPT = '\x1b[1;97mqlang\x1b[0m\x1b[1;36m>\x1b[0m ';

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

export async function runRepl(stdinStream, stdoutWrite, stderrWrite, { initialQuery = null, terminal } = {}) {
  const rootVerbNames = verbNames(await langRuntime());

  // A terminal in raw mode moves the cursor down at `\n` without
  // returning it, so the writers of a terminal write `\r\n`.
  const isInteractiveTty = stdinStream.isTTY === true;
  const writeOutput = isInteractiveTty
    ? (text) => stdoutWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stdoutWrite;
  const writeDiagnostic = isInteractiveTty
    ? (text) => stderrWrite(text.replace(/(?<!\r)\n/g, '\r\n'))
    : stderrWrite;

  // A cell that wrote to stdout by `out` holds the channel: no value of its
  // answer prints after it, while a failure does [QSHST#repl].
  let wroteByOut = false;
  const session = await createSession({
    sources: cliSources({
      stdinReader: () => Promise.resolve(''),
      stdoutWrite: writeOutput,
      stderrWrite: writeDiagnostic,
      recordStdoutEffect: () => { wroteByOut = true; }
    })
  });

  const lineEditor = createLineEditor(stdinStream, stdoutWrite, {
    prompt: PROMPT,
    render: (bufferText) => highlightAnsi(bufferText, rootVerbNames),
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

      wroteByOut = false;
      const cellEntry = await session.evalCell(rawLine, { initialPipeValue: DEFAULT_SUBJECT });
      await writeCellOutcome(cellEntry, rootVerbNames, writeOutput, writeDiagnostic, wroteByOut);
      lineEditor.prompt();
    }
  });
}

// An answer prints on stdout whole and a failure as `boundAnswer` shows it, but
// a value of a cell that wrote by `out`, a failure, one that does not parse with
// its caret, without the prose of its page; a defect raised past the
// fail track as the cell ran or as its answer printed on stderr [QSHST#repl].
async function writeCellOutcome(cellEntry, rootVerbNames, stdoutWrite, stderrWrite, wroteByOut) {
  const { stdoutText, stderrText } = await cellText(cellEntry, async (result, scope) => {
    if (wroteByOut && !isErrorValue(result)) return null;
    const shown = isErrorValue(result) ? await boundAnswer(result, scope) : result;
    return [await printAnswer(shown, scope), caretOf(result)].filter(part => part !== null).join('\n');
  });
  if (stderrText !== undefined) stderrWrite(stderrText);
  else if (stdoutText !== null) stdoutWrite(highlightAnsi(stdoutText, rootVerbNames) + '\n');
}

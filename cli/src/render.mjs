// What the command line writes for a cell and its exit code: a defect raised
// past the fail track as the cell ran or as its answer printed, no answer, as
// its line on stderr with exit 1, nothing once the query wrote to stdout by
// `out`, and any other answer, a failure among them and a query that does not
// parse among those, as the language prints it with exit 0, a failure with
// `outcomeOpts.failureExitCode`, which `--fail` makes 1 [QSHST#answer], [QSPRN#print].

import { isErrorValue, langRuntime, verbNames, printAnswer, elideAnswer, caretOf } from '@kaluchi/qlang-core';
import { highlightAnsi } from './highlight-ansi.mjs';

// The names of the verbs the highlighter marks, read once.
let _rootVerbNamesPromise = null;
async function rootVerbNames() {
  if (_rootVerbNamesPromise === null) {
    _rootVerbNamesPromise = langRuntime().then(scope => verbNames(scope));
  }
  return _rootVerbNamesPromise;
}

// The text painted for a terminal where the caller asks for colour.
async function maybePaint(text, shouldColorize) {
  if (!shouldColorize) return text;
  return highlightAnsi(text, await rootVerbNames());
}

const defectLine = defect => `qlang: ${defect.message}\n`;

// cellText(cellEntry, print) → `{ stdoutText }`, the answer as `print` writes it, or `{ stderrText }`,
// the line of a defect raised as the cell ran or as its answer printed [QSHST#answer], [QSHST#repl].
export async function cellText(cellEntry, print) {
  if (cellEntry.defect !== null) return { stderrText: defectLine(cellEntry.defect) };
  try {
    return { stdoutText: await print(cellEntry.result, cellEntry.scopeAfterCell) };
  } catch (defect) {
    return { stderrText: defectLine(defect) };
  }
}

export async function renderCellOutcome(cellEntry, outcomeOpts) {
  const { didExplicitStdoutEffect, shouldColorize, budget = null, failureExitCode = 0 } = outcomeOpts;
  const { stdoutText, stderrText } = await cellText(cellEntry, async (result, scope) => (didExplicitStdoutEffect ? null : await answerText(result, scope, budget, cellEntry.page ?? null)));
  if (stderrText !== undefined) return { stdoutText: '', stderrText, exitCode: 1 };
  // A failure the query wrote by `out` and left unwritten exits so too.
  const exitCode = isErrorValue(cellEntry.result) ? failureExitCode : 0;
  if (stdoutText === null) return { stdoutText: '', stderrText: '', exitCode };
  // A string is written as its text, which no colour paints as code.
  const painted = typeof cellEntry.result === 'string' ? stdoutText : await maybePaint(stdoutText, shouldColorize);
  return { stdoutText: painted + '\n', stderrText: '', exitCode };
}

// answerText(value, scope, budget, page) → the text the command line writes for
// an answer: a string as it is, so `| json` writes JSON text and `| table` a
// table, and any other value as its print, whole unless the caller asked for a
// budget, an error as its alert, a refused text with its caret below the alert
// where the alert shows its line, and a failure with the prose of its refusal's
// page last, line comments a reading of the literal passes over [QSHST#answer].
export async function answerText(value, scope, budget = null, page = null) {
  if (typeof value === 'string') return value;
  const shown = await elideAnswer(value, budget, scope);
  return [await printAnswer(shown, scope), caretOf(shown), page === null ? null : commentLinesOf(page)].filter(part => part !== null).join('\n');
}

const oneLine = text => text.replace(/\s+/g, ' ').trim();

// Prose as line comments, `|~| ` and the words of a line within the
// width of the catalog's sources.
const COMMENT_WIDTH = 72;
function commentLinesOf(text) {
  const lines = [];
  let line = null;
  for (const word of oneLine(text).split(' ')) {
    if (line !== null && line.length + 1 + word.length > COMMENT_WIDTH) {
      lines.push(line);
      line = null;
    }
    line = line === null ? `|~| ${word}` : `${line} ${word}`;
  }
  lines.push(line);
  return lines.join('\n');
}

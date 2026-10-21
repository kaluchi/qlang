// What the command line writes for a cell and the code it exits with: a
// defect on stderr with 1, nothing after `out`, and any other answer as the
// one print of a host prints it, a failure with the code `--fail` sets
// [QSHST#answer].

import { isErrorValue, langRuntime, verbNames, printAnswer, boundAnswer, caretOf } from '@kaluchi/qlang-core';
import { highlightAnsi } from './highlight-ansi.mjs';
import { proseOfThePage } from './run.mjs';

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
  const { didExplicitStdoutEffect, shouldColorize, failureExitCode = 0 } = outcomeOpts;
  // A query that wrote by `out` holds the channel: no print of its answer and
  // no refusal of one, its code the one its answer exits with [QSHST#answer].
  let failed = isErrorValue(cellEntry.result);
  const { stdoutText, stderrText } = await cellText(cellEntry, async (result, scope) => {
    if (didExplicitStdoutEffect) return null;
    const shown = await boundAnswer(result, scope, typeof result === 'string' ? result : null);
    failed = isErrorValue(shown);
    return await shownText(shown, result, scope, cellEntry.page ?? null);
  });
  if (stderrText !== undefined) return { stdoutText: '', stderrText, exitCode: 1 };
  const exitCode = failed ? failureExitCode : 0;
  if (stdoutText === null) return { stdoutText: '', stderrText: '', exitCode };
  // A string is written as its text, which no colour paints as code.
  const painted = typeof cellEntry.result === 'string' && !failed ? stdoutText : await maybePaint(stdoutText, shouldColorize);
  return { stdoutText: painted + '\n', stderrText: '', exitCode };
}

// answerText(value, scope, page) → the text the command line writes for an
// answer: a string within the budget as it is, any other answer as
// `boundAnswer` shows it, with the caret and the prose of its page below [QSHST#answer].
export async function answerText(value, scope, page = null) {
  return await shownText(await boundAnswer(value, scope, typeof value === 'string' ? value : null), value, scope, page);
}

async function shownText(shown, value, scope, page) {
  if (shown === value && typeof value === 'string') return value;
  const refused = isErrorValue(shown) && shown.tag.name !== (isErrorValue(value) ? value.tag.name : null);
  const prose = refused ? await proseOfThePage(shown, scope) : page;
  return [await printAnswer(shown, scope), caretOf(value), prose === null ? null : commentLinesOf(prose)].filter(part => part !== null).join('\n');
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

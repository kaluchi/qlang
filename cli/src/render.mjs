// [QSCLI#answer], [QSHST#cell]

import { isErrorValue, langRuntime, verbNames, printAnswer, boundAnswer } from '@kaluchi/qlang-core';
import { highlightAnsi } from './highlight-ansi.mjs';
import { contentOfThePage } from './run.mjs';
import { keepCell } from './cells.mjs';

let _rootVerbNamesPromise = null;
async function rootVerbNames() {
  if (_rootVerbNamesPromise === null) {
    _rootVerbNamesPromise = langRuntime().then(scope => verbNames(scope));
  }
  return _rootVerbNamesPromise;
}

async function maybePaint(text, shouldColorize) {
  if (!shouldColorize) return text;
  return highlightAnsi(text, await rootVerbNames());
}

const defectLine = defect => `qlang: ${defect.message}\n`;

// [QSCLI#answer], [QSCLI#repl]
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
  // [QSCLI#answer]
  let failed = isErrorValue(cellEntry.result);
  const { stdoutText, stderrText } = await cellText(cellEntry, async (result, scope) => {
    if (didExplicitStdoutEffect) return null;
    const kept = value => keepCell({ query: cellEntry.source, scope, value });
    const shown = await boundAnswer(result, scope, typeof result === 'string' ? result : null, kept);
    failed = isErrorValue(shown);
    return await shownText(shown, result, scope, cellEntry.page ?? null);
  });
  if (stderrText !== undefined) return { stdoutText: '', stderrText, exitCode: 1 };
  const exitCode = failed ? failureExitCode : 0;
  if (stdoutText === null) return { stdoutText: '', stderrText: '', exitCode };
  const painted = typeof cellEntry.result === 'string' && !failed ? stdoutText : await maybePaint(stdoutText, shouldColorize);
  return { stdoutText: painted + '\n', stderrText: '', exitCode };
}

// [QSPRN#budget]
export async function answerText(value, scope, page = null) {
  return await shownText(await boundAnswer(value, scope, typeof value === 'string' ? value : null), value, scope, page);
}

async function shownText(shown, value, scope, page) {
  if (shown === value && typeof value === 'string') return value;
  const refused = isErrorValue(shown) && shown.tag.name !== (isErrorValue(value) ? value.tag.name : null);
  const shownPage = refused ? await contentOfThePage(shown, scope) : page;
  return [await printAnswer(shown, scope), shownPage === null ? null : commentLinesOf(shownPage)].filter(part => part !== null).join('\n');
}

const oneLine = text => text.replace(/\s+/g, ' ').trim();

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

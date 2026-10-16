// renderCellOutcome(cellEntry, outcomeOpts) → what the command line writes
// for a cell and its exit code: a defect raised past the fail track, no
// answer, on stderr with exit 1, nothing once the query wrote to stdout
// by `out`, and any other answer, a failure among them and a query that
// does not parse among those, as the language prints it with exit 0, a
// failure with `outcomeOpts.failureExitCode`, which `--fail` makes 1
// [QSHST#answer], [QSPRN#print], [QSHST#answer].

import { isErrorValue, langRuntime, verbNames } from '@kaluchi/qlang-core';
import { answerText } from './script-mode.mjs';
import { highlightAnsi } from './highlight-ansi.mjs';

// The names of the verbs the highlighter marks, read once.
let _builtinNamesPromise = null;
async function getBuiltinNames() {
  if (_builtinNamesPromise === null) {
    _builtinNamesPromise = langRuntime().then(env => verbNames(env));
  }
  return _builtinNamesPromise;
}

// The text painted for a terminal where the caller asks for colour.
async function maybePaint(text, shouldColorize) {
  if (!shouldColorize) return text;
  return highlightAnsi(text, await getBuiltinNames());
}

export async function renderCellOutcome(cellEntry, outcomeOpts) {
  const { didExplicitStdoutEffect, shouldColorize, budget = null, failureExitCode = 0 } = outcomeOpts;

  if (cellEntry.error !== null && !isErrorValue(cellEntry.result)) {
    return { stdoutText: '', stderrText: `qlang: ${cellEntry.error.message}\n`, exitCode: 1 };
  }
  // A failure the query wrote by `out` and left unwritten exits so too.
  const exitCode = isErrorValue(cellEntry.result) ? failureExitCode : 0;
  if (didExplicitStdoutEffect) {
    return { stdoutText: '', stderrText: '', exitCode };
  }
  // A string is written as its text, which no colour paints as code.
  const written = await answerText(cellEntry.result, cellEntry.envAfterCell, budget, cellEntry.page ?? null);
  const painted = typeof cellEntry.result === 'string' ? written : await maybePaint(written, shouldColorize);
  return { stdoutText: painted + '\n', stderrText: '', exitCode };
}

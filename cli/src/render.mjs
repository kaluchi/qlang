// renderCellOutcome(cellEntry, outcomeOpts) → what the command line writes
// for a cell and its exit code: a query that does not parse or a defect
// raised past the fail track on stderr with exit 1, nothing once the
// query wrote to stdout by `@out`, and any other answer, a failure among
// them, in the format of the input with exit 0 [D96], [D103].

import { isErrorValue, printAnswer, elideAnswer, langRuntime, verbNames } from '@kaluchi/qlang-core';
import { encodeSuccessValueForFormat } from './script-mode.mjs';
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
  const { resolvedFormat, didExplicitStdoutEffect, shouldColorize, budget = null } = outcomeOpts;

  if (cellEntry.error !== null) {
    // A query that does not parse prints its error, a defect its message.
    const diagnostic = isErrorValue(cellEntry.result)
      ? await maybePaint(await printAnswer(elideAnswer(cellEntry.result, budget), cellEntry.envAfterCell), shouldColorize)
      : `qlang: ${cellEntry.error.message}`;
    return {
      stdoutText: '',
      stderrText: diagnostic + '\n',
      exitCode: 1
    };
  }
  if (didExplicitStdoutEffect) {
    return { stdoutText: '', stderrText: '', exitCode: 0 };
  }
  const encoded = await encodeSuccessValueForFormat(cellEntry.result, resolvedFormat, cellEntry.envAfterCell, budget, cellEntry.page ?? null);
  // The print alone is painted; JSON stays plain for the tools it feeds.
  const painted = resolvedFormat === 'raw'
    ? await maybePaint(encoded, shouldColorize)
    : encoded;
  return { stdoutText: painted + '\n', stderrText: '', exitCode: 0 };
}

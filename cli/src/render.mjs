// Project a session cell entry onto the CLI script-mode outcome:
// stdout bytes to emit, stderr bytes to emit, exit code.
//
// Output shape follows from the input shape (JSON in → JSON out,
// raw in → raw out) plus two explicit overrides:
//
//   * `didExplicitStdoutEffect` — the user's query already pushed
//     bytes to stdout via `@out`. Script mode stops echoing; the
//     user is in control of the channel. `@err`/`@tap` stream to
//     stderr and do not trip this flag.
//
//   * Stdin forced via `--json` that failed to parse surfaces as
//     `cellEntry.error` of kind 'stdinParseError' — stderr message,
//     exit 1, no stdout.
//
// Outcome rules:
//
//   - host-level JS throw (parse / setup error)      → stderr, exit 1
//   - success-track value AND stdout effect was fired
//                                                    → silent stdout, exit 0
//   - success-track value, no stdout effect          → encode value
//                                                      in resolved format,
//                                                      stdout + '\n', exit 0
//   - success-track is a qlang error value           → silent, exit 1
//     (unhandled fail-track — diagnostics are the
//     user's job via `!| @err(pretty)` or a
//     descriptor projection)
//
// REPL mode has its own renderer inline in repl.mjs — the per-cell
// auto-print there stays qlang-native (printValue + ANSI).

import { isErrorValue } from '@kaluchi/qlang-core';
import { encodeSuccessValueForFormat } from './script-mode.mjs';

export function renderCellOutcome(cellEntry, outcomeOpts) {
  const { resolvedFormat, didExplicitStdoutEffect } = outcomeOpts;

  if (cellEntry.error !== null) {
    return {
      stdoutText: '',
      stderrText: `qlang: ${cellEntry.error.message}\n`,
      exitCode: 1
    };
  }
  if (isErrorValue(cellEntry.result)) {
    return { stdoutText: '', stderrText: '', exitCode: 1 };
  }
  if (didExplicitStdoutEffect) {
    return { stdoutText: '', stderrText: '', exitCode: 0 };
  }
  const encoded = encodeSuccessValueForFormat(cellEntry.result, resolvedFormat);
  return { stdoutText: encoded + '\n', stderrText: '', exitCode: 0 };
}

// Project a session cell entry onto the CLI script-mode outcome:
// stdout bytes to emit, stderr bytes to emit, exit code.
//
// Output shape follows from the input shape (JSON in → JSON out,
// raw in → raw out) plus one explicit override:
//
//   * `didExplicitStdoutEffect` — the user's query already pushed
//     bytes to stdout via `@out`. Script mode stops echoing; the
//     user is in control of the channel. `@err`/`@tap` stream to
//     stderr and do not trip this flag.
//
// Outcome rules:
//
//   - host-level JS throw (parse / setup error)      → stderr, exit 1
//   - stdout effect was fired                        → silent stdout, exit 0
//   - success-track value (plain or error value)     → encode value
//                                                      in resolved format,
//                                                      stdout + '\n', exit 0
//
// Error values travel as data on the same channel as plain values —
// they are first-class qlang values per the spec, not a host-level
// failure. Agent harnesses parallelise `qlang` invocations; a
// non-zero exit on a fail-track result would cancel sibling tool
// calls. `printValue` renders the descriptor in qlang-rich form
// (`!{:kind ... :trail ...}`); `toPlain` lifts it to tagged JSON
// (`{$error: {...}}`) for the json channel.
//
// REPL mode has its own renderer inline in repl.mjs — the per-cell
// auto-print there stays qlang-native (printValue + ANSI).

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
  if (didExplicitStdoutEffect) {
    return { stdoutText: '', stderrText: '', exitCode: 0 };
  }
  const encoded = encodeSuccessValueForFormat(cellEntry.result, resolvedFormat);
  return { stdoutText: encoded + '\n', stderrText: '', exitCode: 0 };
}

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
// they are first-class qlang values per the spec, flowing through
// the success-channel render path. Agent harnesses parallelise
// `qlang` invocations and rely on exit-0 for a completed run; a
// non-zero exit on a fail-track result would cancel sibling tool
// calls. `printValue` renders the descriptor in qlang-rich form
// (`!{:kind ... :trail ...}`); `toPlain` lifts it to tagged JSON
// (`{$error: {...}}`) for the json channel.
//
// REPL mode has its own renderer inline in repl.mjs — the per-cell
// auto-print there stays qlang-native (printValue + ANSI).

import { isErrorValue, printValue, langRuntime } from '@kaluchi/qlang-core';
import { encodeSuccessValueForFormat } from './script-mode.mjs';
import { highlightAnsi } from './highlight-ansi.mjs';

// Lazy-init the builtin-name set used by `highlightAnsi` for operand
// classification. langRuntime is cached, so a second call from any
// script-mode invocation hits the same module-level promise and does
// no extra parse work.
let _builtinNamesPromise = null;
async function getBuiltinNames() {
  if (_builtinNamesPromise === null) {
    _builtinNamesPromise = langRuntime().then(env => new Set(env.keys()));
  }
  return _builtinNamesPromise;
}

// Apply ANSI highlighting when the caller has resolved `shouldColorize`
// to true (TTY-detection or explicit `--color=always`). The raw form
// (no highlighting) keeps the output clean for pipelines like
// `qlang '…' | jq` where ANSI escapes would corrupt the downstream
// reader.
async function maybePaint(text, shouldColorize) {
  if (!shouldColorize) return text;
  return highlightAnsi(text, await getBuiltinNames());
}

export async function renderCellOutcome(cellEntry, outcomeOpts) {
  const { resolvedFormat, didExplicitStdoutEffect, shouldColorize } = outcomeOpts;

  if (cellEntry.error !== null) {
    // Parse failures land both as a host-error marker (so the exit
    // code reflects the syntactic failure) AND as a structured
    // `::ParseError!{…}` ErrorValue on the result channel. Render
    // the ErrorValue when present — `printValue` produces the
    // caret-pointer-aware diagnostic; fall back to the raw JS
    // message for non-lifted host failures (setup errors, etc.).
    const diagnostic = isErrorValue(cellEntry.result)
      ? await maybePaint(printValue(cellEntry.result), shouldColorize)
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
  const encoded = encodeSuccessValueForFormat(cellEntry.result, resolvedFormat);
  // Only the qlang-form output (printValue, used when the input
  // format is `raw`) gets colorized — JSON output stays raw so
  // downstream readers (jq, et al.) see the structured payload
  // without ANSI escapes even when piped to a TTY.
  const painted = resolvedFormat === 'raw'
    ? await maybePaint(encoded, shouldColorize)
    : encoded;
  return { stdoutText: painted + '\n', stderrText: '', exitCode: 0 };
}

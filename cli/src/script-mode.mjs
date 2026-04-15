// Script-mode I/O shape: the symmetric pair that turns piped stdin
// into an initial pipeValue and the cell's success-track value back
// into stdout bytes, so `cat data.json | qlang '/path'` acts as a
// filter — JSON in → JSON out, text in → text out — without the
// `@in | parseJson | … | json | @out` ceremony.
//
// REPL mode keeps using printValue for cell auto-output (qlang-
// native display); this module is the script-mode encoder only.
// `@out`/`@err`/`@tap` remain available in both modes as explicit
// dump channels.
//
// Two entrypoints:
//
//   `liftStdinToPipeValue(text, inputFormat)`
//     → { pipeValue, resolvedFormat } on success, or
//     → { parseError, resolvedFormat } on a forced-parse failure
//
//     Resolves the auto / json / raw mode into a concrete format
//     and a pipeValue. `auto` tries JSON.parse; on success it
//     lifts to qlang via `fromPlain` and reports `resolvedFormat:
//     'json'`, otherwise it hands back the raw String with
//     `resolvedFormat: 'raw'`. `json` is strict — a parse failure
//     surfaces as `parseError` for the caller to report as a host-
//     level error and exit 1. `raw` skips parsing entirely.
//
//   `encodeSuccessValueForFormat(value, resolvedFormat)`
//     → String bytes for stdout (no trailing newline — caller adds)
//
//     Symmetric to liftStdinToPipeValue. `json` input → JSON output
//     via `toPlain` + `JSON.stringify(_, null, 2)`. `raw` input →
//     raw pass-through for String success values, printValue
//     fallback for anything else (qlang-native composites). The
//     input format is the contract the user established; the output
//     honours it.

import { fromPlain, toPlain, printValue } from '@kaluchi/qlang-core';

const JSON_PRETTY_INDENT = 2;

export function liftStdinToPipeValue(stdinText, inputFormat) {
  if (inputFormat === 'raw') {
    return { pipeValue: stdinText, resolvedFormat: 'raw' };
  }

  if (inputFormat === 'json') {
    try {
      const parsed = JSON.parse(stdinText);
      return { pipeValue: fromPlain(parsed), resolvedFormat: 'json' };
    } catch (jsParseError) {
      return { parseError: jsParseError, resolvedFormat: 'json' };
    }
  }

  // inputFormat === 'auto'. Empty stdin skips the parse attempt —
  // an empty String is a more useful seed than a ParseError over
  // nothing, and most auto-mode callers with no piped input end up
  // immediately replacing pipeValue via a leading value step.
  if (stdinText.length === 0) {
    return { pipeValue: '', resolvedFormat: 'raw' };
  }
  try {
    const parsed = JSON.parse(stdinText);
    return { pipeValue: fromPlain(parsed), resolvedFormat: 'json' };
  } catch {
    return { pipeValue: stdinText, resolvedFormat: 'raw' };
  }
}

export function encodeSuccessValueForFormat(value, resolvedFormat) {
  if (resolvedFormat === 'json') {
    return JSON.stringify(toPlain(value), null, JSON_PRETTY_INDENT);
  }
  // resolvedFormat === 'raw'. A String success value goes out as-is
  // (the raw-in-raw-out contract); anything else falls back to the
  // qlang literal so the user still sees something meaningful.
  if (typeof value === 'string') return value;
  return printValue(value);
}

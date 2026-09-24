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
//     Standard input lifts only when it carries bytes; with none the
//     pipe starts from `DEFAULT_SUBJECT` [D37]. Otherwise resolves
//     the auto / json / raw mode into a concrete format
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

import { fromPlain, toPlain, printValue, makeTagKeyword } from '@kaluchi/qlang-core';

const JSON_PRETTY_INDENT = 2;

// The noun the command line starts from when standard input carries no
// bytes, outside any project [D37]; the noun of the nearest `.qlang/`
// folder comes with the modules a project ships.
export const DEFAULT_SUBJECT = makeTagKeyword('qlang');

export function liftStdinToPipeValue(stdinText, inputFormat) {
  if (stdinText.length === 0) {
    return { pipeValue: DEFAULT_SUBJECT, resolvedFormat: 'raw' };
  }
  if (inputFormat === 'raw') {
    return { pipeValue: stdinText, resolvedFormat: 'raw' };
  }

  // Each branch keeps `JSON.parse` alone inside its `try`: a
  // syntactic failure is what the mode decides on — `json` reports
  // it, `auto` falls back to the raw-String reading. `fromPlain`
  // runs outside, because a codec refusal (a magnitude outside the
  // finite-double domain) is a decision about the document's
  // content, and swallowing it would re-label a JSON document as
  // text under `auto` or as a syntax failure under `json`.
  if (inputFormat === 'json') {
    let parsed;
    try {
      parsed = JSON.parse(stdinText);
    } catch (jsParseError) {
      return { parseError: jsParseError, resolvedFormat: 'json' };
    }
    return liftParsedDocument(parsed, 'json');
  }

  // inputFormat === 'auto'.
  let parsed;
  try {
    parsed = JSON.parse(stdinText);
  } catch {
    return { pipeValue: stdinText, resolvedFormat: 'raw' };
  }
  return liftParsedDocument(parsed, 'json');
}

// `fromPlain` refuses a magnitude outside the finite-double domain
// a qlang Number lives in — `JSON.parse` reads `1e400` as an
// infinity. The refusal reaches the caller as `codecError` so the
// CLI reports it verbatim, naming the slot it walked to.
function liftParsedDocument(parsed, resolvedFormat) {
  try {
    return { pipeValue: fromPlain(parsed), resolvedFormat };
  } catch (codecRefusal) {
    // `fromPlain` raises one class — `FromPlainNumberNotFiniteError`,
    // carrying `:path` — so the caller reads that field directly.
    return { codecError: codecRefusal, resolvedFormat };
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

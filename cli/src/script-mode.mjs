// Script-mode I/O shape: the symmetric pair that turns piped stdin
// into an initial pipeValue and the cell's success-track value back
// into stdout bytes, so `cat data.json | qlang '/path'` acts as a
// filter — JSON in → JSON out, text in → text out — without the
// `@in | parseJson | … | json | @out` ceremony.
//
// REPL mode prints each cell's value through `print` (qlang-native
// display); this module is the script-mode encoder only.
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
//   `encodeSuccessValueForFormat(value, resolvedFormat, env)`
//     → String bytes for stdout (no trailing newline — caller adds)
//
//     Symmetric to liftStdinToPipeValue. `json` input → JSON output
//     via `toPlain` + `JSON.stringify(_, null, 2)`. `raw` input →
//     raw pass-through for String success values, and the `print` of
//     anything else in the environment the query left [D96]. The
//     input format is the contract the user established; the output
//     honours it.

import {
  fromPlain, toPlain, printAnswer, makeTagKeyword, makeErrorValue, isErrorValue, typeKeyword, keyword, elideAnswer
} from '@kaluchi/qlang-core';
import { recordThrowSiteSpec } from '@kaluchi/qlang-core/errors';

const JSON_PRETTY_INDENT = 2;

// Under JSON, the channel a JSON input chose, an answer holding a value
// JSON has no form for is refused, naming the path of map keys and
// indices to that value and its kind [D103]; a set is written as the
// array of its elements in the one order [D126].
// The refusal is minted as a value where the answer is written, so its
// site records its facts without a factory.
recordThrowSiteSpec('AnswerNotJsonError', 'typeError', { operand: '::qlang/cli' });

const JSON_KINDS = new Set(['null', 'boolean', 'number', 'string', 'vec', 'set', 'map']);

// The first value beneath the answer that JSON has no form for, an
// error among them, with the path to it, or null.
function firstNotJson(value, path) {
  if (isErrorValue(value)) return { value, path };
  const kindName = typeKeyword(value).name;
  if (!JSON_KINDS.has(kindName)) return { value, path };
  const parts = kindName === 'vec' || kindName === 'set' ? value.map((element, index) => [index, element])
    : kindName === 'map' ? [...value].map(([key, entryValue]) => [keyword(key), entryValue])
    : [];
  for (const [pathStep, part] of parts) {
    const found = firstNotJson(part, [...path, pathStep]);
    if (found !== null) return found;
  }
  return null;
}

// The answer the JSON channel writes: the answer itself, an error it
// holds, or the refusal of a value JSON has no form for.
function answerForJson(value) {
  const notJson = firstNotJson(value, []);
  if (notJson === null || isErrorValue(notJson.value)) return notJson?.value ?? value;
  return makeErrorValue(makeTagKeyword('AnswerNotJsonError'),
    new Map([['path', notJson.path], ['actualType', typeKeyword(notJson.value)]]));
}

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

// The answer a channel writes, whole unless the caller asked for a
// budget [D120]: under JSON an error alone gives way within it, data
// answering whole for the tools that read it; the print gives way
// within it.
export async function encodeSuccessValueForFormat(value, resolvedFormat, env, budget = null) {
  if (resolvedFormat === 'json') {
    const answer = answerForJson(value);
    const shown = budget !== null && isErrorValue(answer) ? elideAnswer(answer, budget) : answer;
    return JSON.stringify(toPlain(shown), null, JSON_PRETTY_INDENT);
  }
  // resolvedFormat === 'raw'. A String success value goes out as-is
  // (the raw-in-raw-out contract); anything else goes out as its print.
  if (typeof value === 'string') return value;
  return printAnswer(budget === null ? value : elideAnswer(value, budget), env);
}

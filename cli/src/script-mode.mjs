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
  fromPlain, toPlain, printAnswer, printValue, makeTagKeyword, makeErrorValue, isErrorValue, typeKeyword, keyword, elideAnswer
} from '@kaluchi/qlang-core';
import { recordRefusal } from '@kaluchi/qlang-core/errors';

const JSON_PRETTY_INDENT = 2;

// Under JSON, the channel a JSON input chose, an answer holding a value
// JSON has no form for is refused, naming the path of map keys and
// indices to that value and its kind [D103]; a set is written as the
// array of its elements in the one order [D126], and a keyword as its
// name, as `json` writes it [D148].
// The refusal is minted as a value where the answer is written, so its
// site records its address without a class.
recordRefusal('cli/AnswerNotJsonError');

const JSON_KINDS = new Set(['null', 'boolean', 'number', 'string', 'keyword', 'vec', 'set', 'map']);

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
// holds, or the refusal of a value JSON has no form for, which holds the
// answer as its literal, so a query that asks after a kind, a page or a
// tag reads its answer on that channel too [D192].
function answerForJson(value) {
  const notJson = firstNotJson(value, []);
  if (notJson === null || isErrorValue(notJson.value)) return notJson?.value ?? value;
  return makeErrorValue(makeTagKeyword('cli/AnswerNotJsonError'), new Map([
    ['path', notJson.path], ['actualType', typeKeyword(notJson.value)], ['printed', printValue(value)]]));
}

// The noun the command line starts from when standard input carries no
// bytes, outside any project [D37]; the noun of the nearest `.qlang/`
// folder comes with the sources a project ships.
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
    // `fromPlain` raises one class — `ParseJsonNumberNotFiniteError`,
    // carrying `:path` — so the caller reads that field directly.
    return { codecError: codecRefusal, resolvedFormat };
  }
}

// The answer a channel writes [D120], [D184]: a value whole unless the
// caller asked for a budget, an error an alert; under JSON data answers
// whole for the tools that read it, an error alone giving way within the
// budget, and the print gives way within it. A failure carries the prose
// of its refusal's page, under `page` in JSON and below the print as
// comment lines, which a reading of the literal passes over [D195].
export async function encodeSuccessValueForFormat(value, resolvedFormat, env, budget = null, page = null) {
  if (resolvedFormat === 'json') {
    const answer = answerForJson(value);
    const shown = isErrorValue(answer) ? elideAnswer(answer, budget) : answer;
    const plain = toPlain(shown);
    if (page !== null) plain.$error.page = oneLine(page);
    return JSON.stringify(plain, null, JSON_PRETTY_INDENT);
  }
  // resolvedFormat === 'raw'. A String success value goes out as-is
  // (the raw-in-raw-out contract); anything else goes out as its print.
  if (typeof value === 'string') return value;
  const printed = await printAnswer(elideAnswer(value, budget), env);
  return page === null ? printed : `${printed}\n${commentLinesOf(page)}`;
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

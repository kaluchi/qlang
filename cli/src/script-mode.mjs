// The streams of the command line: standard input lifts to the query's
// first value, a JSON document as its value and any other text as a
// string, and the answer goes back in the format of the input [D37].

import {
  fromPlain, toPlain, printAnswer, printValue, makeTagKeyword, makeErrorValue, isErrorValue, typeKeyword, keyword, elideAnswer
} from '@kaluchi/qlang-core';
import { recordRefusal } from '@kaluchi/qlang-core/errors';

const JSON_PRETTY_INDENT = 2;

// Under JSON, the channel a JSON input chose, an answer holding a value
// JSON has no form for is refused, naming the path of map keys and
// indices to that value and its kind [D103]; a set is written as the
// array of its elements in the one order [D126], and a keyword as its
// name, as `json` writes it [D148]; the refusal is a value made where
// the answer is written, its address recorded without a class.
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

// liftStdinToPipeValue(text, inputFormat) → the first value and the
// format the input resolved to: the noun of the language with no bytes,
// the text under `raw`, the document under `json`, which refuses a text
// that does not parse, and under `auto` the document where the text
// parses and the text where it does not.
export function liftStdinToPipeValue(stdinText, inputFormat) {
  if (stdinText.length === 0) {
    return { pipeValue: DEFAULT_SUBJECT, resolvedFormat: 'raw' };
  }
  if (inputFormat === 'raw') {
    return { pipeValue: stdinText, resolvedFormat: 'raw' };
  }

  // `JSON.parse` alone stands in each `try`, so a document that parses
  // and holds a number past the doubles is refused as a document.
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

// The document lifted to a value, or the refusal of a number past the
// doubles at the path `fromPlain` names.
function liftParsedDocument(parsed, resolvedFormat) {
  try {
    return { pipeValue: fromPlain(parsed), resolvedFormat };
  } catch (codecRefusal) {
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
  // A string goes out as it is, any other answer as its print.
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

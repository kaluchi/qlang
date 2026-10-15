// The streams of the command line: standard input lifts to the query's
// first value, a JSON document as its value and any other text as a
// string [QSHST#input], and the answer is written as the language prints it,
// whatever the input was, a query converting it where a reader wants
// another format, `| json` [QSHST#answer].

import { fromPlain, printAnswer, makeTag, elideAnswer } from '@kaluchi/qlang-core';

// The noun the command line starts from when standard input carries no
// bytes, outside any project [QSHST#input]; the noun of the nearest `.qlang/`
// folder comes with the sources a project ships.
export const DEFAULT_SUBJECT = makeTag('qlang');

// liftStdinToPipeValue(text, inputFormat) → the first value: the noun of
// the language with no bytes, the text under `raw`, the document under
// `json`, which refuses a text that does not parse, and under `auto` the
// document where the text parses and the text where it does not.
export function liftStdinToPipeValue(stdinText, inputFormat) {
  if (stdinText.length === 0) {
    return { pipeValue: DEFAULT_SUBJECT };
  }
  if (inputFormat === 'raw') {
    return { pipeValue: stdinText };
  }

  // `JSON.parse` alone stands in the `try`, so a document that parses
  // and holds a number past the doubles is refused as a document.
  let parsed;
  try {
    parsed = JSON.parse(stdinText);
  } catch (jsParseError) {
    return inputFormat === 'json' ? { parseError: jsParseError } : { pipeValue: stdinText };
  }
  return liftParsedDocument(parsed);
}

// The document lifted to a value, or the refusal of a number past the
// doubles at the path `fromPlain` names.
function liftParsedDocument(parsed) {
  try {
    return { pipeValue: fromPlain(parsed) };
  } catch (codecRefusal) {
    return { codecError: codecRefusal };
  }
}

// answerText(value, env, budget, page) → the text the command line writes for
// an answer [QSHST#answer]: a string as it is, so `| json` writes JSON text
// and `| table` a table, and any other value as its print, whole unless the
// caller asked for a budget [QSHST#answer], an error as its alert, a failure
// carrying the prose of its refusal's page below it as line comments a reading
// of the literal passes over [QSHST#answer].
export async function answerText(value, env, budget = null, page = null) {
  if (typeof value === 'string') return value;
  const printed = await printAnswer(await elideAnswer(value, budget, env), env);
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

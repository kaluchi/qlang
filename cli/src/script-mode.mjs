// The streams of the command line: standard input lifts to the query's
// first value, a JSON document as its value and any other text as a
// string, and the answer is written as the language prints it, whatever
// the data was, a query converting it where a reader wants another format,
// `| json` [QSHST#stdin], [QSHST#answer].

import { fromJsonText, printAnswer, makeTag, elideAnswer, caretOf } from '@kaluchi/qlang-core';

// The noun the command line starts from when standard input carries no
// bytes [QSHST#stdin].
export const DEFAULT_SUBJECT = makeTag('qlang');

// liftStdinToPipeValue(text, stdinFormat) → the first value: the noun of
// the language with no bytes, the text under `raw`, the document under
// `json`, which refuses a text that does not parse, and under `auto` the
// document where the text parses and the text where it does not.
export function liftStdinToPipeValue(stdinText, stdinFormat) {
  if (stdinText.length === 0) {
    return { pipeValue: DEFAULT_SUBJECT };
  }
  if (stdinFormat === 'raw') {
    return { pipeValue: stdinText };
  }

  // `JSON.parse` alone stands in the `try`, so a document that parses
  // and holds a number past the doubles is refused as a document.
  try {
    JSON.parse(stdinText);
  } catch (jsParseError) {
    return stdinFormat === 'json' ? { parseError: jsParseError } : { pipeValue: stdinText };
  }
  return liftParsedDocument(stdinText);
}

// The document lifted to a value as a literal reads it, the keys of each
// object in the order the text writes them, or the refusal of a number
// past the doubles at the path `fromJsonText` names [QSLIT#json].
function liftParsedDocument(stdinText) {
  try {
    return { pipeValue: fromJsonText(stdinText) };
  } catch (codecRefusal) {
    return { codecError: codecRefusal };
  }
}

// answerText(value, scope, budget, page) → the text the command line writes for
// an answer: a string as it is, so `| json` writes JSON text and `| table` a
// table, and any other value as its print, whole unless the caller asked for a
// budget, an error as its alert, a refused text with its caret below the alert
// where the alert shows its line, and a failure with the prose of its refusal's
// page last, line comments a reading of the literal passes over [D360].
export async function answerText(value, scope, budget = null, page = null) {
  if (typeof value === 'string') return value;
  const shown = await elideAnswer(value, budget, scope);
  return [await printAnswer(shown, scope), caretOf(shown), page === null ? null : commentLinesOf(page)].filter(part => part !== null).join('\n');
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

// Standard input of the command line [QSHST#stdin]: the text it holds, read to
// its end, or the empty string where it is a terminal, which `main` reads before
// a query that reads its subject runs, and the first value it lifts to, a JSON
// document as its value and any other text as a string.

import { fromJsonText, makeTag } from '@kaluchi/qlang-core';

export function readStdinToString(stdin) {
  if (stdin.isTTY) {
    return Promise.resolve('');
  }
  return new Promise((resolve, reject) => {
    let buffer = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => { buffer += chunk; });
    stdin.on('end', () => resolve(buffer));
    stdin.on('error', reject);
  });
}

// Memoise a stdinReader thunk so repeated `in` calls within a
// single query share one read of the underlying stream.
export function memoiseStdinReader(stdinReader) {
  let cachedPromise = null;
  return () => {
    if (cachedPromise === null) {
      cachedPromise = stdinReader();
    }
    return cachedPromise;
  };
}

// The noun the command line starts from when standard input carries no
// bytes.
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

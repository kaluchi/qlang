// Standard input of the command line [QSHST#stdin]: the text it holds, read to
// its end, or the empty string where it is a terminal, which `main` reads before
// a query that reads its subject runs, and the first value it lifts to by the
// word `parseJson`, a JSON document as its value and any other text as a
// string [D402].

import { isErrorValue, makeTag } from '@kaluchi/qlang-core';

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

// liftOfInput(session, text, raw) → the first value of a query that reads its
// subject, `{ initialPipeValue }`, or the cell of the word that refused the
// text, `{ refused }`: the noun of the language where the text is empty, the
// text under `--raw`, and otherwise what `parseJson` answers run on it as a
// cell the session numbers not, a text that is no JSON staying the string it
// is [D402].
const TEXT_NOT_JSON = 'string/parseJson/TextNotJsonError';

export async function liftOfInput(session, stdinText, raw) {
  if (stdinText.length === 0) return { initialPipeValue: DEFAULT_SUBJECT };
  if (raw) return { initialPipeValue: stdinText };
  const read = await session.evalCell('parseJson', { initialPipeValue: stdinText, uri: 'stdin' });
  if (read.defect !== null || (isErrorValue(read.result) && read.result.tag.name !== TEXT_NOT_JSON)) return { refused: read };
  return { initialPipeValue: isErrorValue(read.result) ? stdinText : read.result };
}

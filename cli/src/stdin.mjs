// Standard input of the command line [QSCLI#stdin]: its text, read to its end,
// the empty string from a terminal, and the first value a query that reads its
// subject starts from, which `parseJson` lifts the text to.

import { isErrorValue, makeTag, StringParseJsonTextNotJsonError } from '@kaluchi/qlang-core';

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

// One read of the stream for every `in` of a query and for its subject.
export function memoiseStdinReader(stdinReader) {
  let cachedPromise = null;
  return () => {
    if (cachedPromise === null) {
      cachedPromise = stdinReader();
    }
    return cachedPromise;
  };
}

// The noun the command line starts from where stdin carries no bytes.
export const DEFAULT_SUBJECT = makeTag('qlang');

// liftOfInput(session, text, raw) → `{ initialPipeValue }`, the noun of the
// language for no text, the text under `--raw`, and else what `parseJson`
// answers in a cell the session numbers not, a text that is no JSON staying
// the string and any other refusal the failure the query starts from; or
// `{ raised }`, the cell of a defect of the lift.
export async function liftOfInput(session, stdinText, raw) {
  if (stdinText.length === 0) return { initialPipeValue: DEFAULT_SUBJECT };
  if (raw) return { initialPipeValue: stdinText };
  const read = await session.evalCell('parseJson', { initialPipeValue: stdinText, uri: 'stdin' });
  if (read.defect !== null) return { raised: read };
  const notJson = isErrorValue(read.result) && read.result.tag.name === StringParseJsonTextNotJsonError.prototype.address;
  return { initialPipeValue: notJson ? stdinText : read.result };
}

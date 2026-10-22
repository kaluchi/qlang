// [QSCLI#stdin]

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

export function memoiseStdinReader(stdinReader) {
  let cachedPromise = null;
  return () => {
    if (cachedPromise === null) {
      cachedPromise = stdinReader();
    }
    return cachedPromise;
  };
}

export const DEFAULT_SUBJECT = makeTag('qlang');

export async function liftOfInput(session, stdinText, raw) {
  if (stdinText.length === 0) return { initialPipeValue: DEFAULT_SUBJECT };
  if (raw) return { initialPipeValue: stdinText };
  const read = await session.evalCell('parseJson', { initialPipeValue: stdinText, uri: 'stdin' });
  if (read.defect !== null) return { raised: read };
  const notJson = isErrorValue(read.result) && read.result.tag.name === StringParseJsonTextNotJsonError.prototype.address;
  return { initialPipeValue: notJson ? stdinText : read.result };
}

// [QSCLI#stdin]

import { isErrorValue, makeTag, StringParseJsonTextNotJsonError } from '@kaluchi/qlang-core';

export function readStdinToString(stdin) {
  if (stdin.isTTY) {
    return Promise.resolve('');
  }
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder();
    let text = '';
    stdin.on('data', (chunk) => { text += decoder.decode(chunk, { stream: true }); });
    stdin.on('end', () => resolve(text + decoder.decode()));
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

export async function liftOfInput(notebook, stdinText) {
  if (stdinText.length === 0) return { initialPipeValue: DEFAULT_SUBJECT };
  const read = await notebook.evalCell('parseJson', { initialPipeValue: stdinText, uri: 'stdin' });
  if (read.defect !== null) return { raised: read };
  const notJson = isErrorValue(read.result) && read.result.tag.name === StringParseJsonTextNotJsonError.prototype.address;
  return { initialPipeValue: notJson ? stdinText : read.result };
}

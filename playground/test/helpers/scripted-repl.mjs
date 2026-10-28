// [QSCLI#repl]

import { Readable } from 'node:stream';

export function captureRepl(scriptedInput) {
  const stdinStream = Readable.from([Buffer.from(scriptedInput)]);
  stdinStream.isTTY = false;

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutWrite = (text) => stdoutChunks.push(text);
  const stderrWrite = (text) => stderrChunks.push(text);

  return {
    stdinStream,
    stdoutWrite,
    stderrWrite,
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE, '');
}

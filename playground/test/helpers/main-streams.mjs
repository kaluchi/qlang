// [QSCLI#answer]

import { Readable, Writable } from 'node:stream';
import { langRuntime } from '@kaluchi/qlang-core';

export function captureStreams(stdinPayload = '') {
  const stdinStream = Readable.from([Buffer.from(stdinPayload)]);
  stdinStream.isTTY = false;

  const stdoutChunks = [];
  const stderrChunks = [];
  const stdoutStream = new Writable({
    write(chunk, _encoding, cb) { stdoutChunks.push(chunk.toString()); cb(); }
  });
  const stderrStream = new Writable({
    write(chunk, _encoding, cb) { stderrChunks.push(chunk.toString()); cb(); }
  });

  return {
    stdinStream, stdoutStream, stderrStream,
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

export async function makeCellEntry({ result = null, defect = null, scope = null } = {}) {
  return {
    source: '…',
    uri: 'cell-1',
    result,
    defect,
    scopeAfterCell: scope ?? await langRuntime()
  };
}

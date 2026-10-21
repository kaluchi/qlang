// The streams `main` runs over, a standard input that holds the text it is
// handed and the writes of stdout and stderr read back, and the entry of a
// cell as a session answers it [QSCLI#answer].

import { Readable, Writable } from 'node:stream';
import { langRuntime } from '@kaluchi/qlang-core';

export function captureStreams(stdinPayload = '') {
  const stdinStream = Readable.from([stdinPayload]);
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

// A cell as a session answers it, over the root unless a test hands the scope its query ran in.
export async function makeCellEntry({ result = null, defect = null, scope = null } = {}) {
  return {
    source: '…',
    uri: 'cell-1',
    result,
    defect,
    scopeAfterCell: scope ?? await langRuntime()
  };
}

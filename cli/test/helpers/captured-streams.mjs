// The streams of a command line a test reads back: the standard input it is
// handed and the text written on stdout and stderr, a host that counts no
// write of `out` [QSHST#effect].

export function captureIoContext(stdinPayload = '') {
  const stdoutChunks = [];
  const stderrChunks = [];
  return {
    stdinReader: () => Promise.resolve(stdinPayload),
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join('')
  };
}

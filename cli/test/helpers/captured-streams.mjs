// The streams of a command line a test reads back: the standard input it is
// handed, the text written on stdout and stderr, and the count of the writes
// of `out`, the effect that holds the channel of the answer [QSHST#effect].

export function captureIoContext(stdinPayload = '') {
  const stdoutChunks = [];
  const stderrChunks = [];
  let recordedStdout = 0;
  return {
    stdinReader: () => Promise.resolve(stdinPayload),
    stdoutWrite: (text) => stdoutChunks.push(text),
    stderrWrite: (text) => stderrChunks.push(text),
    recordStdoutEffect: () => { recordedStdout += 1; },
    stdoutText: () => stdoutChunks.join(''),
    stderrText: () => stderrChunks.join(''),
    stdoutEffectCount: () => recordedStdout
  };
}

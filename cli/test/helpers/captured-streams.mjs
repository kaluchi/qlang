// [QSHST#effect]

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

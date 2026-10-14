// The streams of a command line that reads nothing and writes nowhere,
// for a test that builds the sources of the command line, whose primitives
// take the streams of their host, without running a query on a stream
// [QSDSP#residence].

export const silentStreams = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

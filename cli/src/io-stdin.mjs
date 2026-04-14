// Read the entire stdin stream into a single String. Returns the
// empty string when stdin is a TTY (no piped input).
//
// `@in` calls this through a memoised thunk in main.mjs so a query
// that never references `@in` does not block on input it does not
// want, and a query that references `@in` more than once sees the
// same content (stdin is consumed once at OS level).

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

// Memoise a stdinReader thunk so repeated `@in` calls within a
// single query share one read of the underlying stream.
export function memoiseStdinReader(stdinReader) {
  let cachedPromise = null;
  return () => {
    if (cachedPromise === null) {
      cachedPromise = stdinReader();
    }
    return cachedPromise;
  };
}

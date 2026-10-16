// The text stdin holds, read to its end, or the empty string where stdin is
// a terminal, which `main` reads before a query that reads its subject runs.
// The decisions it exists for: [QSHST#input].

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

// Memoise a stdinReader thunk so repeated `in` calls within a
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

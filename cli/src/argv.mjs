// argv parser for the qlang CLI.
//
// Reads the trailing slice of `process.argv` (the bin name and the
// node binary already stripped by the caller) and returns a
// `cliInvocation` describing the user's intent — five shapes today:
//
//   { kind: 'evalQuery', queryText, inputFormat }
//   { kind: 'repl' }
//   { kind: 'help' }
//   { kind: 'version' }
//   { kind: 'usageError', message }
//
// `inputFormat` is one of 'auto' | 'json' | 'raw' and decides how
// piped stdin lands on the cell's initial pipeValue plus how the
// success-track value encodes back to stdout. Default is 'auto':
// JSON.parse stdin if it looks parseable, otherwise hand it to the
// query as a String. `--json` forces the parse (and fails loudly
// on malformed input); `--raw` skips parsing entirely.
//
// Pure function, no side effects. main.mjs branches on `kind` to
// dispatch into the rest of the runtime.

export const HELP_TEXT = `qlang \u2014 pipeline query language

Usage:  qlang [--json | --raw] <query>
        qlang -i | --repl
        qlang -h | --help
        qlang -V | --version

Script mode evaluates the query against piped stdin and writes the
result to stdout: JSON in → JSON out, text in → text out. Use -i
for an interactive REPL. Quote the query so the shell does not
split on whitespace or pipe characters.

Input mode (script):
  (default)   auto-detect — try JSON.parse on stdin; on failure
              hand the raw text to the query as a String
  --json      force JSON.parse on stdin; exit 1 on parse failure
  --raw       skip parsing — stdin is the literal String subject

Examples:
  curl -s api/users | qlang '/data * /name'
  cat data.json     | qlang '/glossary/title'
  echo hi           | qlang --raw 'append(" world")'
  qlang '[1 2 3] | filter(gt(1)) | count'
  qlang -i

See https://github.com/kaluchi/qlang for the language reference.
`;

export const VERSION_LINE = '@kaluchi/qlang-cli 0.1.0\n';

export function parseArgv(argvSlice) {
  let inputFormat = 'auto';
  let cursor = 0;

  while (cursor < argvSlice.length) {
    const head = argvSlice[cursor];
    if (head === '-h' || head === '--help')    return { kind: 'help' };
    if (head === '-V' || head === '--version') return { kind: 'version' };
    if (head === '-i' || head === '--repl')    return { kind: 'repl' };
    if (head === '--json') { inputFormat = 'json'; cursor += 1; continue; }
    if (head === '--raw')  { inputFormat = 'raw';  cursor += 1; continue; }
    return { kind: 'evalQuery', queryText: head, inputFormat };
  }

  return {
    kind: 'usageError',
    message: 'qlang: missing query. See `qlang --help` for usage.\n'
  };
}

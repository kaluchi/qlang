// argv parser for the qlang CLI.
//
// Reads the trailing slice of `process.argv` (the bin name and the
// node binary already stripped by the caller) and returns a
// `cliInvocation` describing the user's intent — the four shapes
// the skeleton recognises today:
//
//   { kind: 'evalQuery', queryText }
//   { kind: 'help' }
//   { kind: 'version' }
//   { kind: 'usageError', message }
//
// Pure function, no side effects. main.mjs branches on `kind` to
// dispatch into the rest of the runtime. Future commits add input /
// output / module / session flags by extending the recognised set;
// the kind discriminator keeps the dispatch site exhaustive.

export const HELP_TEXT = `qlang \u2014 pipeline query language

Usage:  qlang <query>
        qlang -h | --help
        qlang -V | --version

Evaluate a qlang query and print the result. The query string is the
first positional argument; quote it so the shell does not split on
whitespace or pipe characters.

Examples:
  qlang '[1 2 3] | filter(gt(1)) | count'
  qlang '"hello" | append(" world")'
  qlang '{:a 1 :b 2} | keys'

See https://github.com/kaluchi/qlang for the language reference.
`;

export const VERSION_LINE = '@kaluchi/qlang-cli 0.1.0\n';

export function parseArgv(argvSlice) {
  if (argvSlice.length === 0) {
    return {
      kind: 'usageError',
      message: 'qlang: missing query. See `qlang --help` for usage.\n'
    };
  }
  const head = argvSlice[0];
  if (head === '-h' || head === '--help') {
    return { kind: 'help' };
  }
  if (head === '-V' || head === '--version') {
    return { kind: 'version' };
  }
  return { kind: 'evalQuery', queryText: head };
}

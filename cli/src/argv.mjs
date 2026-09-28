// argv parser for the qlang CLI.
//
// Reads the trailing slice of `process.argv` (the bin name and the
// node binary already stripped by the caller) and returns a
// `cliInvocation` describing the user's intent — five shapes today:
//
//   { kind: 'evalQuery', queryText, inputFormat, colorMode, budget }
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
// `colorMode` is one of 'auto' | 'always' | 'never' and decides
// whether script-mode output runs through `highlightAnsi`. Default
// `auto` paints when stdout is a TTY and stays raw when the stream
// is piped or redirected — same convention git / grep / ls follow.
// `NO_COLOR` / `FORCE_COLOR` env vars feed into the resolution
// downstream; the explicit `--color` flag wins over both.
//
// `VERSION_LINE` reads `@kaluchi/qlang-cli`'s own `package.json` at
// module-load time through `createRequire` so the release script's
// `package.json` bump propagates without a per-release source edit.
//
// Pure function, no side effects. main.mjs branches on `kind` to
// dispatch into the rest of the runtime.

import { createRequire } from 'node:module';
// The characters an answer prints within unless `--full` lifts the
// budget, an error, an alert, within fewer [D109].
export const ANSWER_BUDGET = { value: 4000, error: 1000 };

const _cliPackage = createRequire(import.meta.url)('../package.json');

export const HELP_TEXT = `qlang \u2014 pipeline query language

Usage:  qlang [--json | --raw] [--color=MODE] [--full] <query>
        qlang [--full] -i | --repl
        qlang -h | --help
        qlang -V | --version

Script mode evaluates the query against piped stdin and writes the
answer to stdout in the form the input came in. JSON input is the
subject as values, an object a map whose keys are keywords, and the
answer is written as JSON, where a value JSON has no form for, a
quote, a set, a keyword or a tag, is refused as ::AnswerNotJsonError.
Text input is a String, and the answer is written as its print;
'| json' writes JSON text. Use -i for an interactive REPL. Quote
the query so the shell does not split on whitespace or pipe
characters. qlang '::qlang | docs' reads the language, and
qlang '::cli | docs' this command line.

Input mode (script):
  (default)   auto-detect — try JSON.parse on stdin; on failure
              hand the raw text to the query as a String
  --json      force JSON.parse on stdin; exit 1 on parse failure
  --raw       skip parsing — stdin is the String subject, and the
              answer is written as its print

Output budget:
  (default)   an answer prints within ${ANSWER_BUDGET.value} characters, an error
              within ${ANSWER_BUDGET.error}; what does not fit gives way to
              ::elision markers whose :read continues the query to
              the part left out; under JSON an error alone is cut,
              data answering whole
  --full      print the answer whole

Output colour:
  --color=auto    (default) paint if stdout is a terminal, raw
                  if piped or redirected
  --color=always  paint unconditionally
  --color=never   never paint
  Environment:    NO_COLOR=1 forces never; FORCE_COLOR=1 forces
                  always (the explicit --color flag overrides both).

Examples:
  curl -s api/users | qlang '/data * /name'
  cat data.json     | qlang '/glossary/title'
  echo hi           | qlang --raw 'append " world"'
  cat app.log       | qlang --raw 'lines | filter ~(contains "ERROR") | json'
  qlang '[1 2 3] | filter ~(gt 1) | count'
  qlang -i

See https://github.com/kaluchi/qlang for the language reference.
`;

export const VERSION_LINE = `@kaluchi/qlang-cli ${_cliPackage.version}\n`;

const COLOR_MODES = new Set(['auto', 'always', 'never']);


export function parseArgv(argvSlice) {
  let inputFormat = 'auto';
  let colorMode = 'auto';
  let budget = ANSWER_BUDGET;
  let cursor = 0;

  while (cursor < argvSlice.length) {
    const head = argvSlice[cursor];
    if (head === '-h' || head === '--help')    return { kind: 'help' };
    if (head === '-V' || head === '--version') return { kind: 'version' };
    if (head === '-i' || head === '--repl')    return { kind: 'repl', budget };
    if (head === '--full') { budget = null; cursor += 1; continue; }
    if (head === '--json') { inputFormat = 'json'; cursor += 1; continue; }
    if (head === '--raw')  { inputFormat = 'raw';  cursor += 1; continue; }
    if (head.startsWith('--color=')) {
      const value = head.slice('--color='.length);
      if (!COLOR_MODES.has(value)) {
        return {
          kind: 'usageError',
          message: `qlang: --color expects auto / always / never, got '${value}'\n`
        };
      }
      colorMode = value;
      cursor += 1;
      continue;
    }
    return { kind: 'evalQuery', queryText: head, inputFormat, colorMode, budget };
  }

  return {
    kind: 'usageError',
    message: 'qlang: missing query. See `qlang --help` for usage.\n'
  };
}

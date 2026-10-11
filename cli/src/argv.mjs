// parseArgv(args) → what the arguments after the command ask for, one of
//   { kind: 'evalQuery', queryText, inputFormat, colorMode, budget }
//   { kind: 'repl', budget, initialQuery }
//   { kind: 'help' }, { kind: 'version' }, { kind: 'usageError', message }
// the format of the input `auto`, `json` or `raw`, the colour `auto`,
// `always` or `never`, and the budget null or the characters every
// answer prints within [D120], [D184].

import { createRequire } from 'node:module';

const _cliPackage = createRequire(import.meta.url)('../package.json');

export const HELP_TEXT = `qlang \u2014 pipeline query language

Usage:  qlang [--json | --raw] [--color=MODE] [--budget=N] <query>
        qlang [--budget=N] -i | --repl [<query>]
        qlang -h | --help
        qlang -V | --version

Script mode evaluates the query against piped stdin and writes the
answer to stdout in the form the input came in. JSON input is the
subject as values, an object a map whose keys are keywords, and the
answer is written as JSON, a set as an array and a keyword as its
name, where a value JSON has no form for, a quote or a tag, is refused
as ::cli/AnswerNotJsonError. Text input is a string, and the answer
is written as its print; '| json' writes JSON text. Use -i for an
interactive REPL, a query after it run as its first cell. Quote the
query so the shell does not split on whitespace or pipe characters.
qlang '::qlang | doc' reads the language, and qlang '::cli | doc'
this command line.

Input mode (script):
  (default)   auto-detect — try JSON.parse on stdin; on failure
              hand the raw text to the query as a string
  --json      force JSON.parse on stdin; exit 1 on parse failure
  --raw       skip parsing — stdin is the string subject, and the
              answer is written as its print

Output budget:
  (default)   a value prints whole, and an error as an alert: the
              subject where it arose cut to an excerpt, each subject
              it passed an ::elision marker whose :read continues the
              query to it
  --budget=N  print every answer within N characters; what does not
              fit gives way to ::elision markers whose :read continues
              the query to the part left out; under JSON an error alone
              is cut, data answering whole. A query bounds its own
              answer the same way by '| elide N'.

Output colour:
  --color=auto    (default) paint if stdout is a terminal, raw
                  if piped or redirected
  --color=always  paint unconditionally
  --color=never   never paint
  Environment:    NO_COLOR=1 forces never; FORCE_COLOR=1 forces
                  always (the explicit --color flag overrides both).

Examples:
  curl -s api/users | qlang '/data | map ~/name'
  cat data.json     | qlang '/glossary/title'
  echo hi           | qlang --raw 'append " world"'
  cat app.log       | qlang --raw 'lines | filter ~(contains "ERROR") | json'
  qlang '[1 2 3] | filter ~(gt 1) | count'
  qlang -i '::qlang | doc | links | map ~open'

See https://github.com/kaluchi/qlang for the language reference.
`;

export const VERSION_LINE = `@kaluchi/qlang-cli ${_cliPackage.version}\n`;

const COLOR_MODES = new Set(['auto', 'always', 'never']);


export function parseArgv(argvSlice) {
  let inputFormat = 'auto';
  let colorMode = 'auto';
  let budget = null;
  let isRepl = false;
  let cursor = 0;

  while (cursor < argvSlice.length) {
    const head = argvSlice[cursor];
    if (head === '-h' || head === '--help')    return { kind: 'help' };
    if (head === '-V' || head === '--version') return { kind: 'version' };
    if (head === '-i' || head === '--repl') { isRepl = true; cursor += 1; continue; }
    if (head.startsWith('--budget=')) {
      const value = head.slice('--budget='.length);
      if (!/^[1-9][0-9]*$/.test(value)) {
        return { kind: 'usageError', message: `qlang: --budget expects a positive count of characters, got '${value}'\n` };
      }
      budget = Number(value);
      cursor += 1;
      continue;
    }
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
    if (isRepl) return { kind: 'repl', budget, initialQuery: head };
    return { kind: 'evalQuery', queryText: head, inputFormat, colorMode, budget };
  }

  if (isRepl) return { kind: 'repl', budget, initialQuery: null };
  return {
    kind: 'usageError',
    message: 'qlang: missing query. See `qlang --help` for usage.\n'
  };
}

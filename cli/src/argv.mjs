import { createRequire } from 'node:module';

const _cliPackage = createRequire(import.meta.url)('../package.json');

export const HELP_TEXT = `qlang \u2014 pipeline query language

Usage:  qlang [--json | --raw] [--color=MODE] [--budget=N] <query>
        qlang [--budget=N] -i | --repl [<query>]
        qlang -h | --help
        qlang -V | --version

Script mode runs the query on what stdin holds and prints the answer
as the language prints it. JSON input is the subject as values, an
object a map whose keys are keywords, and other text a string. A
query that reads no subject, '[1 2] | sum' or '::vec | doc', reads no
stdin; one that reads it with nothing piped, a terminal or < /dev/null,
runs on ::qlang. The answer is written as its literal and a string as
its text, so '| json' writes JSON text and '!| json' a failure's; a
failure prints as its alert, the prose of its refusal's page below it.
Use -i for an interactive REPL, a query after it run as its first
cell. Quote the query so the shell does not split on whitespace or
pipe characters. qlang '::cli | doc' reads this command line, and
qlang '::qlang | doc' the language.

Input mode (script):
  (default)   auto-detect — try JSON.parse on stdin; on failure
              hand the raw text to the query as a string
  --json      stdin must be JSON; a text that does not parse answers
              ::string/parseJson/TextNotJsonError, exit 0 as every answer
  --raw       skip parsing — stdin is the string subject

Output budget:
  (default)   a value prints whole, and an error as an alert: the
              subject where it arose cut to an excerpt, each subject
              it passed an ::elision marker whose :read continues the
              query to it
  --budget=N  print every answer within N characters; what does not
              fit gives way to ::elision markers whose :read continues
              the query to the part left out. A query bounds its own
              answer the same way by '| elide N'.

Output colour:
  --color=auto    (default) paint if stdout is a terminal, raw
                  if piped or redirected
  --color=always  paint unconditionally
  --color=never   never paint
  Environment:    NO_COLOR=1 forces never; FORCE_COLOR=1 forces
                  always (the explicit --color flag overrides both).

Examples:
  curl -s api/users | qlang 'get /data | map /name'
  qlang 'get /glossary/title' < data.json
  qlang 'get /users | filter /active | json' < data.json
  echo hi           | qlang --raw 'append " world"'
  qlang --raw 'lines | filter ~(contains "ERROR") | count' < app.log
  qlang '[1 2 3] | filter ~(gt 1) | count'
  qlang -i '::qlang | doc | links | map ~open'

See https://github.com/kaluchi/qlang for the language reference.
`;

export const VERSION_LINE = `@kaluchi/qlang-cli ${_cliPackage.version}\n`;

const COLOR_MODES = new Set(['auto', 'always', 'never']);

// An argument after the query is read by nothing, so a flag written there,
// `--budget=10`, is refused rather than left unread [D120].
const argumentAfterTheQuery = argument => ({
  kind: 'usageError',
  message: `qlang: '${argument}' after the query is read by nothing: the flags stand before the query, which is one argument, \`qlang [flags] '<query>'\`\n`
});

// parseArgv(argvSlice) → what the arguments of the command line ask for,
// one of
//   { kind: 'evalQuery', queryText, inputFormat, colorMode, budget }
//   { kind: 'repl', budget, initialQuery }
//   { kind: 'help' }, { kind: 'version' }, { kind: 'usageError', message }
// the format of the input `auto`, `json` or `raw`, the colour `auto`,
// `always` or `never`, and the budget null or the characters every
// answer prints within [D7], [D120].
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
    if (cursor + 1 < argvSlice.length) return argumentAfterTheQuery(argvSlice[cursor + 1]);
    if (isRepl) return { kind: 'repl', budget, initialQuery: head };
    return { kind: 'evalQuery', queryText: head, inputFormat, colorMode, budget };
  }

  if (isRepl) return { kind: 'repl', budget, initialQuery: null };
  return {
    kind: 'usageError',
    message: 'qlang: missing query. See `qlang --help` for usage.\n'
  };
}

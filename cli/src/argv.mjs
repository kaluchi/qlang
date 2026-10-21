import { createRequire } from 'node:module';

const _cliPackage = createRequire(import.meta.url)('../package.json');

// The query `-h` runs, the page of the command line [QSCLI#answer].
const HELP_QUERY = '::cli | doc';

export const VERSION_LINE = `@kaluchi/qlang-cli ${_cliPackage.version}\n`;

const COLOR_MODES = new Set(['auto', 'always', 'never']);

// An argument after the query, which nothing reads, is refused [QSCLI#answer].
const argumentAfterTheQuery = argument => ({
  kind: 'usageError',
  message: `qlang: '${argument}' after the query is read by nothing: the flags stand before the query, which is one argument, \`qlang [flags] '<query>'\`\n`
});

// An argument opening with `--` that names no flag is refused [QSCLI#answer].
const noFlag = argument => ({
  kind: 'usageError',
  message: `qlang: ${argument} is no flag of the command line, which \`qlang --help\` lists\n`
});

// parseArgv(argvSlice) → what the arguments ask for: `{ kind: 'evalQuery',
// queryText, stdinFormat, colorMode, failureExitCode }`, `-h` the query of
// the page of the command line, `{ kind: 'repl', initialQuery }`,
// `{ kind: 'version' }` or `{ kind: 'usageError', message }`, the input read
// `auto` or `raw`, the colour `auto`, `always` or `never`, and a failure's
// code 0, or 1 under `--fail` [QSCLI#answer].
export function parseArgv(argvSlice) {
  let stdinFormat = 'auto';
  let colorMode = 'auto';
  let failureExitCode = 0;
  let isRepl = false;
  let cursor = 0;

  while (cursor < argvSlice.length) {
    const head = argvSlice[cursor];
    if (head === '-h' || head === '--help')    return { kind: 'evalQuery', queryText: HELP_QUERY, stdinFormat, colorMode, failureExitCode };
    if (head === '-V' || head === '--version') return { kind: 'version' };
    if (head === '-i' || head === '--repl') { isRepl = true; cursor += 1; continue; }
    if (head === '--raw')  { stdinFormat = 'raw';  cursor += 1; continue; }
    if (head === '--fail') { failureExitCode = 1; cursor += 1; continue; }
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
    if (head.startsWith('--')) return noFlag(head);
    if (cursor + 1 < argvSlice.length) return argumentAfterTheQuery(argvSlice[cursor + 1]);
    if (isRepl) return { kind: 'repl', initialQuery: head };
    return { kind: 'evalQuery', queryText: head, stdinFormat, colorMode, failureExitCode };
  }

  if (isRepl) return { kind: 'repl', initialQuery: null };
  return {
    kind: 'usageError',
    message: 'qlang: missing query. See `qlang --help` for usage.\n'
  };
}

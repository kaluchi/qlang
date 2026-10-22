import { createRequire } from 'node:module';

const _cliPackage = createRequire(import.meta.url)('../package.json');

// [QSCLI#answer]
const HELP_QUERY = '::cli | doc';

export const VERSION_LINE = `@kaluchi/qlang-cli ${_cliPackage.version}\n`;

const COLOR_MODES = new Set(['auto', 'always', 'never']);

const argumentAfterTheQuery = argument => ({
  kind: 'usageError',
  message: `qlang: '${argument}' after the query is read by nothing: the flags stand before the query, which is one argument, \`qlang [flags] '<query>'\`\n`
});

const noFlag = argument => ({
  kind: 'usageError',
  message: `qlang: ${argument} is no flag of the command line, which \`qlang --help\` lists\n`
});

export function parseArgv(argvSlice) {
  let colorMode = 'auto';
  let failureExitCode = 0;
  let isRepl = false;
  let cursor = 0;

  while (cursor < argvSlice.length) {
    const head = argvSlice[cursor];
    if (head === '-h' || head === '--help')    return { kind: 'evalQuery', queryText: HELP_QUERY, colorMode, failureExitCode };
    if (head === '-V' || head === '--version') return { kind: 'version' };
    if (head === '-i' || head === '--repl') { isRepl = true; cursor += 1; continue; }
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
    return { kind: 'evalQuery', queryText: head, colorMode, failureExitCode };
  }

  if (isRepl) return { kind: 'repl', initialQuery: null };
  return {
    kind: 'usageError',
    message: 'qlang: missing query. See `qlang --help` for usage.\n'
  };
}

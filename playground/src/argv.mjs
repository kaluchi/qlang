import { createRequire } from 'node:module';

const _playgroundPackage = createRequire(import.meta.url)('../package.json');

// [QSCLI#answer]
const HELP_QUERY = '::host | doc';

export const VERSION_LINE = `@kaluchi/qlang-playground ${_playgroundPackage.version}\n`;

const COLOR_MODES = new Set(['auto', 'always', 'never']);

const argumentAfterTheQuery = argument => ({
  kind: 'usageError',
  message: `qplay: '${argument}' after the query is read by nothing: the flags stand before the query, which is one argument, \`qplay [flags] '<query>'\`\n`
});

const noFlag = argument => ({
  kind: 'usageError',
  message: `qplay: ${argument} is no flag of the playground, which \`qplay --help\` lists\n`
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
          message: `qplay: --color expects auto / always / never, got '${value}'\n`
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
    message: 'qplay: missing query. See `qplay --help` for usage.\n'
  };
}

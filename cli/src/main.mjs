import { existsSync } from 'node:fs';
import { parse, readsItsSubject, splitAddress } from '@kaluchi/qlang-core';
import { parseArgv, VERSION_LINE } from './argv.mjs';
import { runQuery } from './run.mjs';
import { renderCellOutcome } from './render.mjs';
import { runRepl } from './repl.mjs';
import { readStdinToString, memoiseStdinReader } from './stdin.mjs';
import { IN_ADDRESS } from './streams.mjs';

export function resolveShouldColorize(colorMode, stdoutStream, env) {
  if (colorMode === 'always') return true;
  if (colorMode === 'never')  return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  if (env.NO_COLOR    && env.NO_COLOR    !== '') return false;
  return Boolean(stdoutStream.isTTY);
}

const SHELL_PATH_OF_A_QUERY = /^[A-Za-z]:\//;

const SHELL_PATH_HINT = 'qlang: the shell turned a query that began with `/` into a path; '
  + "a part is read by `get`, `qlang 'get /data/users'`, which the shell leaves alone, or run it as `MSYS_NO_PATHCONV=1 qlang '…'`\n";

const MSYS_RUNTIME = 'usr/bin/msys-2.0.dll';

// [QSCLI#shell]
export function queryAsWritten(queryText, env, exists = existsSync) {
  if (env.MSYSTEM === undefined || !SHELL_PATH_OF_A_QUERY.test(queryText)) return queryText;
  for (let slash = queryText.indexOf('/'); slash !== -1; slash = queryText.indexOf('/', slash + 1)) {
    if (exists(queryText.slice(0, slash + 1) + MSYS_RUNTIME)) return queryText.slice(slash);
  }
  return queryText;
}

// [QSCLI#stdin]
const VERBS_OF_NO_SUBJECT = new Set([IN_ADDRESS, splitAddress(IN_ADDRESS)[1]]);

function queryReadsStdin(queryText) {
  let quote;
  try {
    quote = parse(queryText);
  } catch {
    return false;
  }
  return readsItsSubject(quote, VERBS_OF_NO_SUBJECT);
}

export async function main(argvSlice, stdinStream, stdoutStream, stderrStream, env) {
  const stdoutWrite = (text) => stdoutStream.write(text);
  const stderrWrite = (text) => stderrStream.write(text);

  const cliInvocation = parseArgv(argvSlice);

  if (cliInvocation.kind === 'version') {
    stdoutWrite(VERSION_LINE);
    return 0;
  }
  if (cliInvocation.kind === 'usageError') {
    stderrWrite(cliInvocation.message);
    return 2;
  }
  if (cliInvocation.kind === 'repl') {
    return await runRepl(stdinStream, stdoutWrite, stderrWrite, {
      initialQuery: queryAsWritten(cliInvocation.initialQuery, env),
      terminal: stdoutStream
    });
  }

  const queryText = queryAsWritten(cliInvocation.queryText, env);
  const readsStdin = queryReadsStdin(queryText);
  const stdinText = readsStdin ? await readStdinToString(stdinStream) : '';

  const stdinReader = memoiseStdinReader(() => (readsStdin ? Promise.resolve(stdinText) : readStdinToString(stdinStream)));

  let didExplicitStdoutEffect = false;
  const recordStdoutEffect = () => { didExplicitStdoutEffect = true; };

  const cellEntry = await runQuery(
    queryText,
    { stdinReader, stdoutWrite, stderrWrite, recordStdoutEffect },
    { stdinText }
  );

  const cliOutcome = await renderCellOutcome(cellEntry, {
    didExplicitStdoutEffect,
    shouldColorize: resolveShouldColorize(cliInvocation.colorMode, stdoutStream, env),
    failureExitCode: cliInvocation.failureExitCode
  });

  stdoutWrite(cliOutcome.stdoutText);
  stderrWrite(cliOutcome.stderrText);
  if (SHELL_PATH_OF_A_QUERY.test(queryText)) stderrWrite(SHELL_PATH_HINT);
  return cliOutcome.exitCode;
}

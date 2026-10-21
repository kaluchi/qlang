// main(argv, stdin, stdout, stderr, env) → the exit code of the command line:
// the version, the REPL, or a query run on what standard input lifts to, its
// answer written as the language prints it unless the query wrote by `out`;
// the streams are handed in, so a test runs it without a process.

import { existsSync } from 'node:fs';
import { parse, readsItsSubject, splitAddress } from '@kaluchi/qlang-core';
import { parseArgv, VERSION_LINE } from './argv.mjs';
import { runQuery } from './run.mjs';
import { renderCellOutcome } from './render.mjs';
import { runRepl } from './repl.mjs';
import { readStdinToString, memoiseStdinReader } from './stdin.mjs';
import { IN_ADDRESS } from './streams.mjs';

// Whether the answer is painted: as `--color` says, and under `auto` as
// `FORCE_COLOR`, `NO_COLOR` and then a terminal on stdout say.
export function resolveShouldColorize(colorMode, stdoutStream, env) {
  if (colorMode === 'always') return true;
  if (colorMode === 'never')  return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  if (env.NO_COLOR    && env.NO_COLOR    !== '') return false;
  return Boolean(stdoutStream.isTTY);
}

// A query no qlang source begins with, a drive and a slash, which Git Bash
// writes for an argument that began with `/`, `qlang '/data/users'` arriving
// as `C:/Program Files/Git/data/users`; the note goes beside its failure.
const SHELL_PATH_OF_A_QUERY = /^[A-Za-z]:\//;

const SHELL_PATH_HINT = 'qlang: the shell turned a query that began with `/` into a path; '
  + "a part is read by `get`, `qlang 'get /data/users'`, which the shell leaves alone, or run it as `MSYS_NO_PATHCONV=1 qlang '…'`\n";

// The runtime of MSYS beneath Git Bash, under the root it writes a path from.
const MSYS_RUNTIME = 'usr/bin/msys-2.0.dll';

// queryAsWritten(queryText, env, exists?) → the query as the reader wrote it:
// under MSYS, whose `MSYSTEM` names it, one that begins with the root of the
// shell, the nearest directory of its path that holds the runtime, read from
// the slash after it [QSHST#shell]; any other query as it came.
export function queryAsWritten(queryText, env, exists = existsSync) {
  if (env.MSYSTEM === undefined || !SHELL_PATH_OF_A_QUERY.test(queryText)) return queryText;
  for (let slash = queryText.indexOf('/'); slash !== -1; slash = queryText.indexOf('/', slash + 1)) {
    if (exists(queryText.slice(0, slash + 1) + MSYS_RUNTIME)) return queryText.slice(slash);
  }
  return queryText;
}

// `in`, which reads no subject, by its address and its name [D402].
const VERBS_OF_NO_SUBJECT = new Set([IN_ADDRESS, splitAddress(IN_ADDRESS)[1]]);

// Whether a query that parses reads the subject stdin lifts to [QSHST#stdin].
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

  // `in` reads the text standard input already gave, or reads it then.
  const stdinReader = memoiseStdinReader(() => (readsStdin ? Promise.resolve(stdinText) : readStdinToString(stdinStream)));

  let didExplicitStdoutEffect = false;
  const recordStdoutEffect = () => { didExplicitStdoutEffect = true; };

  const cellEntry = await runQuery(
    queryText,
    { stdinReader, stdoutWrite, stderrWrite, recordStdoutEffect },
    { stdinText, raw: cliInvocation.stdinFormat === 'raw' }
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

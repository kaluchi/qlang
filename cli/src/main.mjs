// main(argv, stdin, stdout, stderr, env) → the exit code of the command
// line: the help, the version, the REPL over the streams, or a query run
// on what standard input lifts to, its answer written as the language
// prints it unless the query wrote to stdout by `@out`; the streams are
// handed in, so a test runs it without a process.

import { existsSync } from 'node:fs';
import { parse, readsItsSubject } from '@kaluchi/qlang-core';
import { parseArgv, HELP_TEXT, VERSION_LINE } from './argv.mjs';
import { runQuery } from './run.mjs';
import { renderCellOutcome } from './render.mjs';
import { runRepl } from './repl.mjs';
import { readStdinToString, memoiseStdinReader } from './io-stdin.mjs';
import { liftStdinToPipeValue } from './script-mode.mjs';

// Whether the answer is painted: as `--color` says, and under `auto` as
// `FORCE_COLOR`, then `NO_COLOR` say, and otherwise where stdout is a
// terminal.
export function resolveShouldColorize(colorMode, stdoutStream, env) {
  if (colorMode === 'always') return true;
  if (colorMode === 'never')  return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  if (env.NO_COLOR    && env.NO_COLOR    !== '') return false;
  return Boolean(stdoutStream.isTTY);
}

// The path to the number a document holds past the doubles, written as
// the projection that reads it.
function slotSuffixOf(codecError) {
  const path = codecError.facts.path;
  return path.length === 0 ? '' : ` at ${path.map(segment => `/${segment}`).join('')}`;
}

// A query no qlang source begins with: a drive and a slash, the path
// Git Bash on Windows writes for an argument that began with `/`, so
// `qlang '/data/users'` arrives as `C:/Program Files/Git/data/users`.
const SHELL_PATH_OF_A_QUERY = /^[A-Za-z]:\//;

const SHELL_PATH_HINT = 'qlang: the shell turned a query that began with `/` into a path; '
  + "begin it with a pipe, `| /data/users`, or run it as `MSYS_NO_PATHCONV=1 qlang '/data/users'`\n";

// The runtime of MSYS, the shell beneath Git Bash, under the root it
// writes a path from.
const MSYS_RUNTIME = 'usr/bin/msys-2.0.dll';

// queryAsWritten(queryText, env, exists?) → the query as the reader
// wrote it: under MSYS, whose `MSYSTEM` names it, a query that begins
// with the root of the shell, the nearest directory of its path that
// holds the runtime, is read from the slash after the root, which the
// shell wrote the root before [D199]; any other query as it came.
export function queryAsWritten(queryText, env, exists = existsSync) {
  if (env.MSYSTEM === undefined || !SHELL_PATH_OF_A_QUERY.test(queryText)) return queryText;
  for (let slash = queryText.indexOf('/'); slash !== -1; slash = queryText.indexOf('/', slash + 1)) {
    if (exists(queryText.slice(0, slash + 1) + MSYS_RUNTIME)) return queryText.slice(slash);
  }
  return queryText;
}

// Whether a query reads the subject standard input lifts to [D215]; a
// query that does not parse reads none, its refusal written at once.
function queryReadsInput(queryText) {
  let ast;
  try {
    ast = parse(queryText);
  } catch {
    return false;
  }
  return readsItsSubject(ast);
}

export async function main(argvSlice, stdinStream, stdoutStream, stderrStream, env = process.env) {
  const stdoutWrite = (text) => stdoutStream.write(text);
  const stderrWrite = (text) => stderrStream.write(text);

  const cliInvocation = parseArgv(argvSlice);

  if (cliInvocation.kind === 'help') {
    stdoutWrite(HELP_TEXT);
    return 0;
  }
  if (cliInvocation.kind === 'version') {
    stdoutWrite(VERSION_LINE);
    return 0;
  }
  if (cliInvocation.kind === 'usageError') {
    stderrWrite(cliInvocation.message);
    return 2;
  }
  if (cliInvocation.kind === 'repl') {
    return await runRepl(stdinStream, stdoutWrite, stderrWrite, { budget: cliInvocation.budget, initialQuery: queryAsWritten(cliInvocation.initialQuery, env) });
  }

  // A query that reads no subject, `[1 2] | sum` or `::vec | doc`, runs
  // without waiting on standard input, which a shell may hand open with
  // nothing piped [D215].
  const queryText = queryAsWritten(cliInvocation.queryText, env);
  const readsInput = queryReadsInput(queryText);
  const stdinText = readsInput ? await readStdinToString(stdinStream) : '';
  const lifted = liftStdinToPipeValue(stdinText, cliInvocation.inputFormat);

  if (lifted.parseError) {
    stderrWrite(`qlang: --json input: ${lifted.parseError.message}\n`);
    return 1;
  }
  if (lifted.codecError) {
    stderrWrite(`qlang: stdin: ${lifted.codecError.message}${slotSuffixOf(lifted.codecError)}\n`);
    return 1;
  }

  // `@in` reads the text standard input already gave, or reads it then.
  const stdinReader = memoiseStdinReader(() => (readsInput ? Promise.resolve(stdinText) : readStdinToString(stdinStream)));

  let didExplicitStdoutEffect = false;
  const recordStdoutEffect = () => { didExplicitStdoutEffect = true; };

  const cellEntry = await runQuery(
    queryText,
    { stdinReader, stdoutWrite, stderrWrite, recordStdoutEffect },
    { initialPipeValue: lifted.pipeValue }
  );

  const cliOutcome = await renderCellOutcome(cellEntry, {
    didExplicitStdoutEffect,
    shouldColorize: resolveShouldColorize(cliInvocation.colorMode, stdoutStream, env),
    budget: cliInvocation.budget
  });

  if (cliOutcome.stdoutText) stdoutWrite(cliOutcome.stdoutText);
  if (cliOutcome.stderrText) stderrWrite(cliOutcome.stderrText);
  if (cliOutcome.exitCode !== 0 && SHELL_PATH_OF_A_QUERY.test(queryText)) stderrWrite(SHELL_PATH_HINT);
  return cliOutcome.exitCode;
}

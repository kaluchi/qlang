// Top-level CLI orchestrator — reads a process-argv slice plus the
// stdin / stdout / stderr stream trio, dispatches on the parsed
// cliInvocation, and returns the exit code. bin.mjs is the
// single-line bootstrap that wires the Node runtime and forwards
// the resolved exit code to `process.exit`.
//
// Streams (rather than write callbacks) cross the boundary because
// the REPL needs an actual Readable for `node:readline`; the
// script-mode branch derives its writers and stdin reader from the
// same stream trio. No direct `process.*` references inside the
// orchestrator keeps the entire flow unit-testable without spawning
// a subprocess.

import { parseArgv, HELP_TEXT, VERSION_LINE } from './argv.mjs';
import { runQuery } from './run.mjs';
import { renderCellOutcome } from './render.mjs';
import { runRepl } from './repl.mjs';
import { readStdinToString, memoiseStdinReader } from './io-stdin.mjs';

export async function main(argvSlice, stdinStream, stdoutStream, stderrStream) {
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
    return await runRepl(stdinStream, stdoutWrite, stderrWrite);
  }

  const stdinReader = memoiseStdinReader(() => readStdinToString(stdinStream));
  const cellEntry = await runQuery(cliInvocation.queryText, {
    stdinReader, stdoutWrite, stderrWrite
  });
  const cliOutcome = renderCellOutcome(cellEntry);
  if (cliOutcome.stderrText) stderrWrite(cliOutcome.stderrText);
  return cliOutcome.exitCode;
}

// Top-level CLI orchestrator — reads a process-argv slice plus the
// stdinReader thunk and stdout / stderr writers, dispatches on the
// parsed cliInvocation, and returns the exit code. bin.mjs is the
// single-line bootstrap that wires the Node runtime and forwards
// the resolved exit code to `process.exit`.
//
// Pure async function over its inputs and the explicitly-passed
// I/O surface — no direct `process.*` references inside the
// orchestrator keeps the entire flow unit-testable without spawning
// a subprocess. The `@in` / `@out` / `@err` / `@tap` operands
// inside the user's query reach the same writers via the ioContext
// bag handed down to runQuery.

import { parseArgv, HELP_TEXT, VERSION_LINE } from './argv.mjs';
import { runQuery } from './run.mjs';
import { renderCellOutcome } from './render.mjs';

export async function main(argvSlice, stdinReader, stdoutWrite, stderrWrite) {
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

  const cellEntry = await runQuery(cliInvocation.queryText, {
    stdinReader, stdoutWrite, stderrWrite
  });
  const cliOutcome = renderCellOutcome(cellEntry);
  if (cliOutcome.stderrText) stderrWrite(cliOutcome.stderrText);
  return cliOutcome.exitCode;
}

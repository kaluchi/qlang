// Top-level CLI orchestrator — reads a process-argv slice plus the
// stdin / stdout / stderr stream trio, dispatches on the parsed
// cliInvocation, and returns the exit code. bin.mjs is the
// single-line bootstrap that wires the Node runtime and forwards
// the resolved exit code to `process.exit`.
//
// Script mode (non-REPL) acts as a filter:
//   1. Read piped stdin to a String.
//   2. Resolve the inputFormat (auto / json / raw) into a concrete
//      initial pipeValue and a resolvedFormat label.
//   3. Bind I/O + format + parse operands, evaluate the query with
//      the initial pipeValue seeded via session.evalCell.
//   4. If the query wrote to stdout via `@out`, stop — user is in
//      control. Otherwise encode the success-track value back into
//      the resolvedFormat (JSON in → JSON out, raw in → raw out).
//
// Streams cross the boundary because the REPL needs an actual
// Readable for raw-mode keystroke capture; the script-mode branch
// derives its writers and the stdin text from the same stream
// trio. The orchestrator stays free of direct `process.*`
// references, keeping the entire flow unit-testable without
// spawning a subprocess.

import { parseArgv, HELP_TEXT, VERSION_LINE } from './argv.mjs';
import { runQuery } from './run.mjs';
import { renderCellOutcome } from './render.mjs';
import { runRepl } from './repl.mjs';
import { readStdinToString, memoiseStdinReader } from './io-stdin.mjs';
import { liftStdinToPipeValue } from './script-mode.mjs';

// Resolve the user-facing `--color={auto,always,never}` argument
// plus the `NO_COLOR` / `FORCE_COLOR` env vars plus the actual
// `stdout.isTTY` flag into a single boolean: paint or not.
//
// Precedence — explicit > environment > terminal-detection:
//   --color=always         → true
//   --color=never          → false
//   FORCE_COLOR set        → true     (only if --color=auto)
//   NO_COLOR set           → false    (only if --color=auto)
//   stdout is a TTY        → true     (auto, default)
//   stdout is piped / file → false    (auto, default)
//
// The explicit flag wins over both env vars because the user typed
// it for this invocation; env vars are the shell default.
export function resolveShouldColorize(colorMode, stdoutStream, env) {
  if (colorMode === 'always') return true;
  if (colorMode === 'never')  return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  if (env.NO_COLOR    && env.NO_COLOR    !== '') return false;
  return Boolean(stdoutStream.isTTY);
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
    return await runRepl(stdinStream, stdoutWrite, stderrWrite);
  }

  const stdinText = await readStdinToString(stdinStream);
  const lifted = liftStdinToPipeValue(stdinText, cliInvocation.inputFormat);

  if (lifted.parseError) {
    stderrWrite(`qlang: --json input: ${lifted.parseError.message}\n`);
    return 1;
  }

  // Memoised reader feeds the `@in` operand if the user's query
  // explicitly reaches for stdin. The stdin bytes are already in
  // hand as `stdinText`; returning them immediately avoids a
  // second pass over the stream.
  const stdinReader = memoiseStdinReader(() => Promise.resolve(stdinText));

  let didExplicitStdoutEffect = false;
  const recordStdoutEffect = () => { didExplicitStdoutEffect = true; };

  const cellEntry = await runQuery(
    cliInvocation.queryText,
    { stdinReader, stdoutWrite, stderrWrite, recordStdoutEffect },
    { initialPipeValue: lifted.pipeValue }
  );

  const cliOutcome = await renderCellOutcome(cellEntry, {
    resolvedFormat: lifted.resolvedFormat,
    didExplicitStdoutEffect,
    shouldColorize: resolveShouldColorize(cliInvocation.colorMode, stdoutStream, env)
  });

  if (cliOutcome.stdoutText) stdoutWrite(cliOutcome.stdoutText);
  if (cliOutcome.stderrText) stderrWrite(cliOutcome.stderrText);
  return cliOutcome.exitCode;
}

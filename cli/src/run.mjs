// Run a qlang query through a freshly seeded session with the CLI's
// I/O and format operands bound into env, then return the cell entry
// the session produced. The cell entry — the standard
// Session.evalCell return shape — carries the parsed AST, the
// success-track result (when the pipeline finished on success), the
// thrown JS error (when parse or setup failed), and the env after
// the cell.
//
// The ioContext bag (stdinReader / stdoutWrite / stderrWrite /
// recordStdoutEffect) is closed over by the operand impls in
// io-operands.mjs, so any `@in` / `@out` / `@err` / `@tap` step
// the user's query fires reaches exactly the writers passed in
// here. Tests substitute captured chunks; bin.mjs passes `process.*`
// adapters.
//
// `runOpts.initialPipeValue` (when present) seeds the cell's
// pipeValue slot before the first step — the script-mode entrypoint
// uses this to deliver auto-parsed stdin as the implicit subject of
// the query, so `cat data.json | qlang '/path'` works as a filter.

import { createSession } from '@kaluchi/qlang-core/session';
import { bindIoOperands } from './io-operands.mjs';
import { bindFormatOperands } from './format-operands.mjs';
import { bindParseOperands } from './parse-operands.mjs';

export async function runQuery(queryText, ioContext, runOpts = {}) {
  const session = await createSession();
  bindIoOperands(session, ioContext);
  bindFormatOperands(session);
  bindParseOperands(session);
  const evalOpts = 'initialPipeValue' in runOpts
    ? { initialPipeValue: runOpts.initialPipeValue }
    : {};
  return session.evalCell(queryText, evalOpts);
}

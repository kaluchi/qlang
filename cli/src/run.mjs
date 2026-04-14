// Run a qlang query through a freshly seeded session with the CLI's
// I/O and format operands bound into env, then return the cell entry
// the session produced. The cell entry — the standard
// Session.evalCell return shape — carries the parsed AST, the
// success-track result (when the pipeline finished on success), the
// thrown JS error (when parse or setup failed), and the env after
// the cell.
//
// The ioContext bag (stdinReader / stdoutWrite / stderrWrite) is
// closed over by the operand impls in io-operands.mjs, so any
// `@in` / `@out` / `@err` / `@tap` step the user's query fires
// reaches exactly the writers passed in here. Tests substitute
// captured chunks; bin.mjs passes `process.*` adapters.

import { createSession } from '@kaluchi/qlang-core/session';
import { bindIoOperands } from './io-operands.mjs';
import { bindFormatOperands } from './format-operands.mjs';

export async function runQuery(queryText, ioContext) {
  const session = await createSession();
  bindIoOperands(session, ioContext);
  bindFormatOperands(session);
  return session.evalCell(queryText);
}

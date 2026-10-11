// Run a qlang query through a freshly seeded session with the CLI's
// words of the streams and of table bound into env, then return the cell entry
// the session produced. The cell entry — the standard
// Session.evalCell return shape — carries the parsed AST, the
// success-track result (when the pipeline finished on success), the
// thrown JS error (when parse or setup failed), and the env after
// the cell.
//
// The ioContext bag (stdinReader / stdoutWrite / stderrWrite /
// recordStdoutEffect) is closed over by the primitives of the streams
// in streams.mjs, so any `@in` / `@out` / `@err` / `@tap` step
// the user's query fires reaches exactly the writers passed in
// here. Tests substitute captured chunks; bin.mjs passes `process.*`
// adapters.
//
// `runOpts.initialPipeValue` (when present) seeds the cell's
// pipeValue slot before the first step — the script-mode entrypoint
// uses this to deliver auto-parsed stdin as the implicit subject of
// the query, so `cat data.json | qlang '/path'` works as a filter.

import { isErrorValue } from '@kaluchi/qlang-core';
import { createSession } from '@kaluchi/qlang-core/session';
import { cliSources } from './cli-sources.mjs';

export async function runQuery(queryText, ioContext, runOpts = {}) {
  const session = await createSession({ sources: cliSources(ioContext) });
  const evalOpts = 'initialPipeValue' in runOpts
    ? { initialPipeValue: runOpts.initialPipeValue }
    : {};
  const cellEntry = await session.evalCell(queryText, evalOpts);
  if (cellEntry.error !== null || !isErrorValue(cellEntry.result)) return cellEntry;
  const explained = await session.evalCell(PROSE_OF_THE_PAGE, { initialPipeValue: cellEntry.result });
  return { ...cellEntry, page: typeof explained.result === 'string' ? explained.result : null };
}

// The prose of the page `explain` reads for a failure, its links and
// snippets aside, which the command line writes below the failure so a
// reader repairs the call where it failed [D195]; null for a refusal
// with no page.
const PROSE_OF_THE_PAGE = '!| explain | /page | segments | filter ~(type | eq ::string) | join "" !| null';

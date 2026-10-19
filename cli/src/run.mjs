// runQuery(queryText, ioContext, runOpts) → the cell of a session seeded
// with the command line's sources, whose verbs of the streams read and
// write through `ioContext`, the query's first value the one
// `runOpts.initialPipeValue` gives, and a failure's cell with the prose of
// the page that explains it.

import { isErrorValue, createSession } from '@kaluchi/qlang-core';
import { cliSources } from './cli-sources.mjs';

export async function runQuery(queryText, ioContext, runOpts = {}) {
  const session = await createSession({ sources: cliSources(ioContext) });
  const evalOpts = 'initialPipeValue' in runOpts
    ? { initialPipeValue: runOpts.initialPipeValue }
    : {};
  const cellEntry = await session.evalCell(queryText, evalOpts);
  if (!isErrorValue(cellEntry.result) || cellEntry.result.tag.name === ERROR_KIND) return cellEntry;
  const explained = await session.evalCell(PROSE_OF_THE_PAGE, { initialPipeValue: cellEntry.result });
  return { ...cellEntry, page: typeof explained.result === 'string' ? explained.result : null };
}

// A failure of the kind of errors, which no site refused, has no
// refusal whose page repairs the call.
const ERROR_KIND = 'error';

// The prose of the page of a failure's site, which the command line writes
// below the failure, null for a site with no page [QSHST#answer], [D371].
const PROSE_OF_THE_PAGE = '!| type | doc | prose !| null';

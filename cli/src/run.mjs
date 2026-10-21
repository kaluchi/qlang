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
  if (!isErrorValue(cellEntry.result)) return cellEntry;
  return { ...cellEntry, page: await proseOfThePage(cellEntry.result, cellEntry.scopeAfterCell) };
}

// A failure of the kind of errors, which no site refused, has no
// refusal whose page repairs the call.
const ERROR_KIND = 'error';

// The prose of the page of a failure's site, which the command line writes
// below the failure, null for a site with no page [QSHST#answer], [QSSLF#doc].
const PROSE_OF_THE_PAGE = '!| type | doc | prose !| null';

// proseOfThePage(failure, scope) → the prose of the page of a failure's site
// over the scope the query left, or null [QSHST#answer].
export async function proseOfThePage(failure, scope) {
  if (failure.tag.name === ERROR_KIND) return null;
  const explained = await (await createSession({ scope })).evalCell(PROSE_OF_THE_PAGE, { initialPipeValue: failure });
  return typeof explained.result === 'string' ? explained.result : null;
}

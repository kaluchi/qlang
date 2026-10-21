// runQuery(queryText, ioContext, input) → the cell of the query in a session
// of the command line's sources, its streams those of `ioContext`, run on what
// `input.stdinText` lifts to, a defect of the lift the cell [QSCLI#stdin], and a
// failure's cell with the prose of the page that explains it.

import { isErrorValue, createSession } from '@kaluchi/qlang-core';
import { cliSources } from './cli-sources.mjs';
import { liftOfInput } from './stdin.mjs';

export async function runQuery(queryText, ioContext, { stdinText = '', raw } = {}) {
  const session = await createSession({ sources: cliSources(ioContext) });
  const lifted = await liftOfInput(session, stdinText, raw);
  const cellEntry = lifted.raised ?? await session.evalCell(queryText, lifted);
  if (!isErrorValue(cellEntry.result)) return cellEntry;
  return { ...cellEntry, page: await proseOfThePage(cellEntry.result, cellEntry.scopeAfterCell) };
}

// The kind of errors, which no site refused and no page repairs.
const ERROR_KIND = 'error';

// The prose of the page of a failure's site, which the command line writes
// below the failure, null for a site with no page [QSCLI#answer], [QSSLF#doc].
const PROSE_OF_THE_PAGE = '!| type | doc | prose !| null';

// proseOfThePage(failure, scope) → the prose of the page of a failure's site
// over the scope the query left, or null [QSCLI#answer].
export async function proseOfThePage(failure, scope) {
  if (failure.tag.name === ERROR_KIND) return null;
  const explained = await (await createSession({ scope })).evalCell(PROSE_OF_THE_PAGE, { initialPipeValue: failure });
  return typeof explained.result === 'string' ? explained.result : null;
}

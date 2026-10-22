// [QSCLI#stdin]

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

const ERROR_KIND = 'error';

// [QSCLI#answer], [QSSLF#doc]
const PROSE_OF_THE_PAGE = '!| type | doc | prose !| null';

// [QSCLI#answer]
export async function proseOfThePage(failure, scope) {
  if (failure.tag.name === ERROR_KIND) return null;
  const explained = await (await createSession({ scope })).evalCell(PROSE_OF_THE_PAGE, { initialPipeValue: failure });
  return typeof explained.result === 'string' ? explained.result : null;
}

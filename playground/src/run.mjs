// [QSCLI#stdin]

import { isErrorValue, createNotebook } from '@kaluchi/qlang-core';
import { playgroundSources } from './playground-sources.mjs';
import { liftOfInput } from './stdin.mjs';

export async function runQuery(queryText, ioContext, { stdinText = '' } = {}) {
  const notebook = await createNotebook({ sources: playgroundSources({ ...ioContext, query: queryText }) });
  const lifted = await liftOfInput(notebook, stdinText);
  const cellEntry = lifted.raised ?? await notebook.evalCell(queryText, lifted);
  if (!isErrorValue(cellEntry.result)) return cellEntry;
  return { ...cellEntry, page: await contentOfThePage(cellEntry.result, cellEntry.scopeAfterCell) };
}

const ERROR_KIND = 'error';

// [QSCLI#answer], [QSSLF#doc]
const CONTENT_OF_THE_PAGE = '!| tag | doc | content !| null';

// [QSCLI#answer]
export async function contentOfThePage(failure, scope) {
  if (failure.tag.name === ERROR_KIND) return null;
  const explained = await (await createNotebook({ scope })).evalCell(CONTENT_OF_THE_PAGE, { initialPipeValue: failure });
  return typeof explained.result === 'string' ? explained.result : null;
}

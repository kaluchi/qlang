// A module's source that the loader `#qlang/load-source` resolves to
// could not read, a foreign failure of the embedding whose
// `:context.host` names the loader, `'node'` or `'web'`.

import { declareForeignError } from './errors.mjs';

export const SourceLoadError = declareForeignError('SourceLoadError',
  ({ logicalName, sourceLocation, cause, status }) => {
    const tail = cause
      ? cause.message ?? String(cause)
      : (status !== undefined ? `HTTP ${status}` : '');
    return `failed to read qlang source '${logicalName}' from ${sourceLocation}` +
      (tail ? ` — ${tail}` : '');
  },
  { operand: 'use' }
);

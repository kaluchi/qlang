// A source of the language that the loader `#qlang/load-source`
// resolves to could not read, a foreign failure of the embedding, which
// carries the message and the causes of every host's failure [QSERR#site].

import { declareForeignError } from './errors.mjs';

export const BuiltinSourceLoadError = declareForeignError('builtin/SourceLoadError',
  ({ logicalName, sourceLocation, cause, status }) => {
    const tail = cause
      ? cause.message ?? String(cause)
      : (status !== undefined ? `HTTP ${status}` : '');
    return `failed to read qlang source '${logicalName}' from ${sourceLocation}` +
      (tail ? ` — ${tail}` : '');
  });

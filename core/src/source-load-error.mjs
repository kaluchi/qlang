// `SourceLoadError` — shared base for both qlang-source loaders
// (`host/load-source-node.mjs` and `src/load-source-web.mjs`).
// Conditional `#qlang/load-source` resolves to exactly one loader
// per host (Node picks the createRequire+fs path, browsers / Deno
// / Bun pick the import.meta.resolve+fetch path), so only one
// throw site fires per process. The tag identity stays single
// regardless of the host the runtime ships into, and a reader
// tells the hosts apart by `:context.host` (`'node'` vs `'web'`).

import { declareForeignError } from './errors.mjs';

// `declareForeignError` keeps the class off the QlangError
// hierarchy: a source the host cannot read is a failure of the
// embedding, not a value the fail track carries. The spec it
// records is what gives the `::Tag` its `:foreignError` reading.
export const SourceLoadError = declareForeignError('SourceLoadError',
  ({ logicalName, sourceLocation, cause, status }) => {
    const tail = cause
      ? cause.message ?? String(cause)
      : (status !== undefined ? `HTTP ${status}` : '');
    return `failed to read qlang source '${logicalName}' from ${sourceLocation}` +
      (tail ? ` — ${tail}` : '');
  }
);

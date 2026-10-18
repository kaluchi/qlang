// A source of the language that the loader `#qlang/load-source` resolves to
// could not read, a foreign failure of the embedding: `:origin` the source,
// `:sourceLocation` where it was looked for and `:cause` the host's account
// of the failure [QSHST#source].

import { declareForeignError } from './errors.mjs';

export const BuiltinSourceLoadError = declareForeignError('builtin/SourceLoadError',
  ({ origin, sourceLocation, cause }) => `failed to read qlang source '${origin.name}' from ${sourceLocation} — ${cause.message ?? String(cause)}`);

// [QSHST#source]

import { declareForeignError } from './errors.mjs';

export const BuiltinSourceLoadError = declareForeignError('builtin/SourceLoadError',
  ({ origin, sourceLocation, cause }) => `failed to read qlang source '${origin.name}' from ${sourceLocation} — ${cause.message ?? String(cause)}`);

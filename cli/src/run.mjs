// Run a qlang query through a freshly seeded session and return the
// cell entry the session produced. The cell entry — the standard
// Session.evalCell return shape — carries the parsed AST, the
// success-track result (when the pipeline finished on success), the
// thrown JS error (when parse or setup failed), and the env after
// the cell. main.mjs hands the entry to render.mjs to project it
// onto stdout / stderr.
//
// This module owns no I/O and no formatting. It is the seam between
// cli-level intent (a query string) and core-level evaluation (a
// cell entry).

import { createSession } from '@kaluchi/qlang-core/session';

export async function runQuery(queryText) {
  const session = await createSession();
  return session.evalCell(queryText);
}

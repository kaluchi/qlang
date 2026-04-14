// Pure value-to-String formatters the CLI binds alongside the I/O
// operands. Each one takes the pipeValue subject and returns a
// rendered String; chaining them in front of `@out` is how a query
// produces stdout.
//
// Skeleton ships only `pretty` (the canonical qlang-literal form,
// `printValue` exposed as an operand). Follow-up commits add `tjson`
// (tagged-JSON for round-tripping between qlang processes), `json`
// already lives in core, and the renderer family rounds out with
// `ndjson`, `template(:str)`, `raw` as concrete user demands surface.

import { nullaryOp } from '@kaluchi/qlang-core/dispatch';
import { printValue } from '@kaluchi/qlang-core';

export function bindFormatOperands(session) {
  session.bind('pretty', nullaryOp('pretty', (subject) => printValue(subject)));
}

// Project a session cell entry onto the CLI's exit-code contract.
//
// Output bytes are NOT this module's job — the I/O operands
// (`@out` / `@err` / `@tap`) wrote their payloads to stdout / stderr
// during eval. This module only decides:
//
//   - cellEntry.error set (host-level JS throw — parse failure,
//     primitive missing, etc.)            → stderr message, exit 1
//   - cellEntry.result is an error value
//     (pipeline ended on the fail-track
//     without `!|` handling)              → silent, exit 1
//   - success-track value                  → silent, exit 0
//
// Silence on an unhandled fail-track value is the explicit contract:
// users who want diagnostics route their own `!| @err(pretty)` or
// project specific descriptor fields. The CLI does not stand in.
// Host-level JS throws are different — the pipeline never started,
// so there is no `!|` site that could have caught them; the CLI
// surfaces them on stderr to keep "I ran your query but couldn't
// even parse it" from looking identical to "your query ran fine".

import { isErrorValue } from '@kaluchi/qlang-core';

export function renderCellOutcome(cellEntry) {
  if (cellEntry.error !== null) {
    return {
      stderrText: `qlang: ${cellEntry.error.message}\n`,
      exitCode: 1
    };
  }
  if (isErrorValue(cellEntry.result)) {
    return {
      stderrText: '',
      exitCode: 1
    };
  }
  return {
    stderrText: '',
    exitCode: 0
  };
}

// Project a session cell entry onto a CLI outcome — the stdout
// payload to print on the success-track, the stderr payload to print
// when the cell ended on the fail-track or threw during parse / setup,
// and the exit code that mirrors that disposition.
//
// The skeleton renders every value through `printValue` from core's
// runtime/format.mjs (the canonical qlang-literal display form, the
// same shape the `pretty` operand will expose once it lands). Format
// operands (`json`, `tjson`, NDJSON, template) wire in through
// follow-up commits as `@out` and the format-renderer surface grows.

import { printValue, isErrorValue } from '@kaluchi/qlang-core';

export function renderCellOutcome(cellEntry) {
  if (cellEntry.error !== null) {
    return {
      stdoutText: '',
      stderrText: `qlang: ${cellEntry.error.message}\n`,
      exitCode: 1
    };
  }
  if (isErrorValue(cellEntry.result)) {
    return {
      stdoutText: '',
      stderrText: printValue(cellEntry.result) + '\n',
      exitCode: 1
    };
  }
  return {
    stdoutText: printValue(cellEntry.result) + '\n',
    stderrText: '',
    exitCode: 0
  };
}

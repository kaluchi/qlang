// What a page shows for a cell of a session: its answer as the language
// prints it, the caret under the place a parse stopped below it, and a defect
// raised past the fail track, as the cell ran or as its answer printed,
// written as `qlang:` and its message [QSHST#tools], [QSERR#print].

import { printValue, caretOf, isErrorValue } from '@kaluchi/qlang-core';

export function cellShown({ result, defect }) {
  if (defect !== null) return { text: `qlang: ${defect.message}`, failed: true };
  try {
    return { text: [printValue(result), caretOf(result)].filter(part => part !== null).join('\n'), failed: isErrorValue(result) };
  } catch (raised) {
    return { text: `qlang: ${raised.message}`, failed: true };
  }
}

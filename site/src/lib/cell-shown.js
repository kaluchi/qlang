// What a page shows for a cell of a notebook: its answer as a host prints it,
// within the budget of every answer, an answer past it as the refusal in its
// place and a failure as its alert under the line that says it was raised,
// the caret under the place a parse stopped below it, and a defect raised
// past the fail track, as the cell ran or as its answer printed, written as
// `qlang:` and its message [QSHST#notebook], [QSERR#print], [QSPRN#budget].

import { boundAnswer, printAnswer, caretOf, isErrorValue } from '@kaluchi/qlang-core';

export async function cellShown({ result, defect, scopeAfterCell }) {
  if (defect !== null) return { text: `qlang: ${defect.message}`, failed: true };
  try {
    const shown = await boundAnswer(result, scopeAfterCell);
    return { text: [await printAnswer(shown, scopeAfterCell), caretOf(result)].filter(part => part !== null).join('\n'), failed: isErrorValue(shown) };
  } catch (raised) {
    return { text: `qlang: ${raised.message}`, failed: true };
  }
}

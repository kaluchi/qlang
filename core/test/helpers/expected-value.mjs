// [D444]

import { evalQuery } from '../../src/notebook.mjs';
import { factsWithTheirTrace } from '../../src/eval.mjs';
import { printValue } from '../../src/print-value.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/lang-runtime.mjs';
import { beneathTags, isErrorValue, makeErrorValue, tagOf } from '../../src/types.mjs';

// The literal a case writes: the print of the value its query answers, or
// under `raises` the print of the error at rest of the failure it raises.
export const writtenLiteralOf = test => test.raises ?? test.expect;

// A print with the layout of its lines aside, the line breaks and the
// indentation a printer lays a long value out with.
const withoutLayout = text => text.replace(/\s+/g, ' ').replace(/([[{(]) /g, '$1').replace(/ ([\]})])/g, '$1').trim();

// The answer a case writes and the one a query answers, each as its print
// and whether it is raised, so a refusal stands apart from the error at rest
// a catch answers.
export const writtenAnswerOf = test => `${test.raises === undefined ? '' : 'raises '}${withoutLayout(writtenLiteralOf(test))}`;
export const printedAnswerOf = answer => `${isErrorValue(answer) ? 'raises ' : ''}${withoutLayout(printValue(answer))}`;

// The value a case writes, the failure raised from its error at rest under
// `raises`, which the tie of the one order holds to an answer that prints
// alike.
export async function expectedValueOf(test) {
  const literal = await evalQuery(writtenLiteralOf(test));
  if (test.raises === undefined) return literal;
  const facts = await factsWithTheirTrace(new Map(beneathTags(literal)), rootState(literal, await langRuntime()));
  return makeErrorValue(tagOf(literal), facts);
}

// [QSREQ#cases]

import { evalQuery } from '../../src/notebook.mjs';
import { factsWithTheirTrace } from '../../src/eval.mjs';
import { printValue } from '../../src/print-value.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/lang-runtime.mjs';
import { beneathTags, isErrorValue, makeErrorValue, tagOf } from '../../src/types.mjs';

export const writtenLiteralOf = test => test.raises ?? test.expect;

const withoutLayout = text => text.replace(/\s+/g, ' ').replace(/([[{(]) /g, '$1').replace(/ ([\]})])/g, '$1').trim();

export const writtenAnswerOf = test => `${test.raises === undefined ? '' : 'raises '}${withoutLayout(writtenLiteralOf(test))}`;
export const printedAnswerOf = answer => `${isErrorValue(answer) ? 'raises ' : ''}${withoutLayout(printValue(answer))}`;

export async function expectedValueOf(test) {
  const literal = await evalQuery(writtenLiteralOf(test));
  if (test.raises === undefined) return literal;
  const facts = await factsWithTheirTrace(new Map(beneathTags(literal)), rootState(literal, await langRuntime()));
  return makeErrorValue(tagOf(literal), facts);
}

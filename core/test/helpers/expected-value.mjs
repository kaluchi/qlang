// [QSERR#print]

import { evalQuery } from '../../src/notebook.mjs';
import { factsWithTheirTrace } from '../../src/eval.mjs';
import { parseSource } from '../../src/parse.mjs';
import { partOf } from '../../src/walk.mjs';
import { isCallStep } from '../../src/steps.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/lang-runtime.mjs';
import { beneathTags, makeErrorValue, typeOf } from '../../src/types.mjs';

export async function expectedValueOf(expectSource) {
  const literal = raisedLiteralOf(parseSource(expectSource));
  if (literal === null) return await evalQuery(expectSource);
  const atRest = await evalQuery(expectSource.slice(literal.span.start.offset, literal.span.end.offset));
  const facts = await factsWithTheirTrace(new Map(beneathTags(atRest)), rootState(atRest, await langRuntime()));
  return makeErrorValue(typeOf(atRest), facts);
}

export function raisedLiteralOf(quote) {
  const raises = quote.length === 2 && isCallStep(quote[1]) && quote[1].get('name').name === 'raise' && !quote[1].has('modifiers');
  return raises ? partOf(quote).parts[0] : null;
}

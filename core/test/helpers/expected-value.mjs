// The value an expectation spells, the `expect` of a conformance case or
// the result a document shows, read as a query; the print of a failure, its
// error at rest under `raise`, names the failure that holds the facts the
// literal writes, the trace it left among them, laid as `raise` lays it
// [QSERR#print].

import { evalQuery } from '../../src/session.mjs';
import { factsWithTheirTrace } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { partOf } from '../../src/walk.mjs';
import { isCallStep } from '../../src/steps.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { beneathTags, makeErrorValue, typeOf } from '../../src/types.mjs';

export async function expectedValueOf(expectSource) {
  const literal = raisedLiteralOf(parse(expectSource));
  if (literal === null) return await evalQuery(expectSource);
  const atRest = await evalQuery(expectSource.slice(literal.span.start.offset, literal.span.end.offset));
  const facts = await factsWithTheirTrace(new Map(beneathTags(atRest)), rootState(atRest, await langRuntime()));
  return makeErrorValue(typeOf(atRest), facts);
}

// The part of the error literal a failure's print raises, or null for any
// other expectation.
export function raisedLiteralOf(quote) {
  const raises = quote.length === 2 && isCallStep(quote[1]) && quote[1].get('name').name === 'raise' && !quote[1].has('modifiers');
  return raises ? partOf(quote).parts[0] : null;
}

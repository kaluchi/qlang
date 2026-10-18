// The value an expectation spells, the `expect` of a conformance case or
// the result a document shows, read as a query; the print of a failure, its
// error at rest under `raise`, names the failure that holds the facts the
// literal writes, the trace it left among them, laid as `raise` lays it
// [QSERR#print].

import { evalQuery, factsWithTheirTrace } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { rootState } from '../../src/state.mjs';
import { langRuntime } from '../../src/runtime/index.mjs';
import { beneathTags, makeErrorValue, typeOf } from '../../src/types.mjs';

export async function expectedValueOf(expectSource) {
  const literal = raisedLiteralOf(parse(expectSource));
  if (literal === null) return await evalQuery(expectSource);
  const atRest = await evalQuery(literal.text);
  const facts = await factsWithTheirTrace(new Map(beneathTags(atRest)), rootState(atRest, await langRuntime()));
  return makeErrorValue(typeOf(atRest), facts);
}

// The error literal a failure's print raises, or null for any other
// expectation.
export function raisedLiteralOf(ast) {
  if (ast.type !== 'Pipeline' || ast.steps.length !== 2) return null;
  const [literal, { combinator, step }] = ast.steps;
  const raises = combinator === '|' && step.type === 'Call' && step.name === 'raise' && step.args.length === 0;
  return raises ? literal : null;
}

// The value an expectation spells, the `expect` of a conformance case or
// the result a document shows, read as a query; the print of a failure, its
// error at rest under `raise`, names the failure that holds the facts the
// literal writes, the path it flew among them, as they are written
// [QSERR#print].

import { evalQuery } from '../../src/eval.mjs';
import { parse } from '../../src/parse.mjs';
import { beneathTags, makeErrorValue, typeKeyword } from '../../src/types.mjs';

export async function expectedValueOf(expectSource) {
  const literal = raisedLiteralOf(parse(expectSource));
  if (literal === null) return await evalQuery(expectSource);
  const atRest = await evalQuery(literal.text);
  return makeErrorValue(typeKeyword(atRest), new Map(beneathTags(atRest)));
}

// The error literal a failure's print raises, or null for any other
// expectation.
export function raisedLiteralOf(ast) {
  if (ast.type !== 'Pipeline' || ast.steps.length !== 2) return null;
  const [literal, { combinator, step }] = ast.steps;
  const raises = combinator === '|' && step.type === 'Call' && step.name === 'raise' && step.args.length === 0;
  return raises ? literal : null;
}

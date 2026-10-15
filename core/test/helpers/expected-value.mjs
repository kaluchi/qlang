// The value an expectation spells, the `expect` of a conformance case or
// the result a document shows, read as a query: a failure's print reads
// back as the failure with the path it flew [QSERR#print].

import { evalQuery } from '../../src/eval.mjs';

export async function expectedValueOf(expectSource) {
  return await evalQuery(expectSource);
}

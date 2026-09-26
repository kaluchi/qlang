// The value an expectation spells, the `expect` of a conformance case or
// the result a document shows. Its literal is read where a word stands,
// so an error literal there is the value it spells and raises nothing
// [D85].

import { evalQuery } from '../../src/eval.mjs';

export async function expectedValueOf(expectSource) {
  const [expectedValue] = await evalQuery(`[${expectSource}
]`);
  return expectedValue;
}

// Assertions for the refusals of the command line's verbs.
//
// A refusal reaches the query as an error value: its tag is the address
// of what refused, `result !| type` answering
// `::any/out/SubjectNotStringError` and the like, and its facts stand in
// its descriptor in the order the catalog declares them [QSERR#site]. A
// refusal a site of a verb raised keeps the JavaScript instance it
// was raised as in the opaque `originalError` slot, which a host
// re-throws, one kind of error named by the same address.

import { expect } from 'vitest';
import { isErrorValue } from '@kaluchi/qlang-core';
import { QlangError } from '@kaluchi/qlang-core/errors';

// A fact matches the shape listed for it: a value of the language that is
// an object, a keyword or a tag, by the fields listed, any other by value.
function expectFact(errorValue, fact, expected) {
  const actual = errorValue.descriptor.get(fact);
  if (expected !== null && typeof expected === 'object') expect(actual, `the fact :${fact}`).toMatchObject(expected);
  else expect(actual, `the fact :${fact}`).toEqual(expected);
}

// expectRefusalByAddress(cellEntry, address, expectedFacts) → error value
//
// A refusal named by its address, the facts listed among those its error
// value holds: a name's subject, an input's invariant, or a site of a verb.
export function expectRefusalByAddress(cellEntry, address, expectedFacts) {
  expect(cellEntry.error, 'cellEntry.error must be null (the refusal is a value)').toBeNull();
  const errorValue = cellEntry.result;
  expect(isErrorValue(errorValue), 'cellEntry.result must be an error value').toBe(true);
  expect(errorValue.tag.name).toBe(address);
  for (const [fact, expected] of Object.entries(expectedFacts)) expectFact(errorValue, fact, expected);
  return errorValue;
}

// expectRefusalRaised(cellEntry, address, expectedFacts)
//   → the JS error instance (for further ad-hoc assertions)
//
// A refusal a site of a verb raised, lifted onto the fail track
// rather than failing the cell: its error value as above, and the
// instance it was raised as, named by the same address.
export function expectRefusalRaised(cellEntry, address, expectedFacts) {
  const errorValue = expectRefusalByAddress(cellEntry, address, expectedFacts);
  expect(errorValue.originalError, 'originalError must preserve the JS throw instance').toBeInstanceOf(QlangError);
  expect(errorValue.originalError.address).toBe(address);
  return errorValue.originalError;
}

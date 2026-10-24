// [QSERR#site]

import { expect } from 'vitest';
import { isErrorValue } from '@kaluchi/qlang-core';
import { QlangError } from '@kaluchi/qlang-core/errors';

function expectFact(errorValue, fact, expected) {
  const actual = errorValue.facts.get(fact);
  if (expected !== null && typeof expected === 'object') expect(actual, `the fact :${fact}`).toMatchObject(expected);
  else expect(actual, `the fact :${fact}`).toEqual(expected);
}

export function expectRefusalByAddress(cellEntry, address, expectedFacts) {
  expect(cellEntry.defect, 'cellEntry.defect must be null (the refusal is a value)').toBeNull();
  const errorValue = cellEntry.result;
  expect(isErrorValue(errorValue), 'cellEntry.result must be an error value').toBe(true);
  expect(errorValue.tag.name).toBe(address);
  for (const [fact, expected] of Object.entries(expectedFacts)) expectFact(errorValue, fact, expected);
  return errorValue;
}

export function expectRefusalRaised(cellEntry, address, expectedFacts) {
  const errorValue = expectRefusalByAddress(cellEntry, address, expectedFacts);
  expect(errorValue.originalError, 'originalError must preserve the JS throw instance').toBeInstanceOf(QlangError);
  expect(errorValue.originalError.address).toBe(address);
  return errorValue.originalError;
}

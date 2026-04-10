// Shared test helpers for error value assertions.
//
// Runtime errors are error values (5th type). Tests call evalQuery
// and check the result via isErrorValue + descriptor inspection.

import { expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue, keyword } from '../../src/types.mjs';

// expectErrorResult(query) → error value
//
// Evaluates the query and asserts the result is an error value.
// Returns the error value for further assertions.
export function expectErrorResult(query) {
  const result = evalQuery(query);
  expect(isErrorValue(result), `expected error value from "${query}", got ${typeof result}`).toBe(true);
  return result;
}

// expectErrorKind(query, kind) → error value
//
// Asserts the query produces an error value with the given :kind.
export function expectErrorKind(query, kind) {
  const err = expectErrorResult(query);
  const actualKind = err.descriptor.get(keyword('kind'));
  expect(actualKind?.name).toBe(kind);
  return err;
}

// expectErrorThrown(query, thrown) → error value
//
// Asserts the query produces an error value with the given :thrown site.
export function expectErrorThrown(query, thrown) {
  const err = expectErrorResult(query);
  const actualThrown = err.descriptor.get(keyword('thrown'));
  expect(actualThrown?.name).toBe(thrown);
  return err;
}

// expectOriginalError(errorValue, ErrorClass) → original JS Error
//
// Asserts the error value carries an originalError of the given class.
export function expectOriginalError(errorValue, ErrorClass) {
  expect(errorValue.originalError).toBeInstanceOf(ErrorClass);
  return errorValue.originalError;
}

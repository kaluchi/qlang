// Shared test helpers for error value assertions.
//
// Runtime errors are error values (5th type). Tests call evalQuery
// and check the result via isErrorValue + descriptor inspection.

import { expect } from 'vitest';
import { evalQuery } from '../../src/eval.mjs';
import { isErrorValue } from '../../src/types.mjs';

// expectErrorResult(query) → error value
//
// Evaluates the query and asserts the result is an error value.
// Returns the error value for further assertions.
export async function expectErrorResult(query) {
  const evalResult = await evalQuery(query);
  expect(isErrorValue(evalResult), `expected error value from "${query}", got ${typeof evalResult}`).toBe(true);
  return evalResult;
}

// expectErrorThrown(query, address) → error value
//
// Asserts the query produces an error value whose tag is the address of
// the refusal (e.g. `'number/add/SubjectNotNumberError'`) [QSERR#site].
export async function expectErrorThrown(query, address) {
  const errorResult = await expectErrorResult(query);
  expect(errorResult.tag?.name).toBe(address);
  return errorResult;
}

// expectOriginalError(errorValue, ErrorClass) → original JS Error
//
// Asserts the error value carries an originalError of the given class.
export function expectOriginalError(errorValue, ErrorClass) {
  expect(errorValue.originalError).toBeInstanceOf(ErrorClass);
  return errorValue.originalError;
}

// catchOriginalError(query) → originalError | null
//
// Evaluates the query and unwraps the originating JS-side QlangError
// off the resulting ErrorValue's `.originalError` slot (the per-site
// class instance with structured context). Returns `null` on a
// success-track result so the caller can assert pessimistically
// (`expect(caughtErr.name).toBe('FooError')` reads cleanly even when
// the query unexpectedly succeeded — the assertion fails on the null
// rather than on a TypeError). Used by per-site error-identity
// tests where assertions read against `caughtErr.name`,
// `caughtErr.facts.*`, or `instanceof QlangError`.
export async function catchOriginalError(query) {
  const evalResult = await evalQuery(query);
  return isErrorValue(evalResult) ? evalResult.originalError : null;
}

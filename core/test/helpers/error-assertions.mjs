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

// expectErrorKind(query, kind) → error value
//
// Asserts the query produces an error value with the given :kind.
export async function expectErrorKind(query, kind) {
  const errorResult = await expectErrorResult(query);
  const actualKind = errorResult.descriptor.get('kind');
  expect(actualKind?.name).toBe(kind);
  return errorResult;
}

// expectErrorThrown(query, classTagName) → error value
//
// Asserts the query produces an error value whose `:qlang/kind`
// (the universal tagged-value identity slot) is a TagKeyword with
// the given class tag name (e.g. `'AddLeftNotNumberError'`).
export async function expectErrorThrown(query, classTagName) {
  const errorResult = await expectErrorResult(query);
  const identityTag = errorResult.descriptor.get('qlang/kind');
  expect(identityTag?.name).toBe(classTagName);
  return errorResult;
}

// expectOriginalError(errorValue, ErrorClass) → original JS Error
//
// Asserts the error value carries an originalError of the given class.
export function expectOriginalError(errorValue, ErrorClass) {
  expect(errorValue.originalError).toBeInstanceOf(ErrorClass);
  return errorValue.originalError;
}

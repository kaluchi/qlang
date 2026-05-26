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

// expectErrorCategory(query, category) → error value
//
// Asserts the query produces an error value whose underlying JS
// error class names the given broad-bucket category (`'typeError'`,
// `'arityError'`, `'effectLaundering'`, `'parseError'`,
// `'foreignError'`, `'divisionByZero'`, `'invariantError'`,
// `'unresolvedIdentifier'`, ...). The instance descriptor no
// longer carries `:category` — that field lives on the tag-binding's
// catalog body, reachable through `result !| type | spec |
// /category`. JS-side this check rides the equivalent `.kind`
// shortcut on the originating QlangError (the same string the
// catalog body's `:category` value reads as a Keyword).
// For per-tag identity assertions use `expectErrorThrown` against
// `:kind`.
export async function expectErrorCategory(query, category) {
  const errorResult = await expectErrorResult(query);
  expect(errorResult.originalError?.kind).toBe(category);
  return errorResult;
}

// expectErrorThrown(query, classTagName) → error value
//
// Asserts the query produces an error value whose `:kind`
// (the universal tagged-value identity slot) is a TagKeyword with
// the given class tag name (e.g. `'AddLeftNotNumberError'`).
export async function expectErrorThrown(query, classTagName) {
  const errorResult = await expectErrorResult(query);
  const identityTag = errorResult.tag;
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
// `caughtErr.context.*`, or `instanceof QlangTypeError`.
export async function catchOriginalError(query) {
  const evalResult = await evalQuery(query);
  return isErrorValue(evalResult) ? evalResult.originalError : null;
}

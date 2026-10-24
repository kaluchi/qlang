import { expect } from 'vitest';
import { evalQuery } from '../../src/notebook.mjs';
import { isErrorValue } from '../../src/types.mjs';

export async function expectErrorResult(query) {
  const evalResult = await evalQuery(query);
  expect(isErrorValue(evalResult), `expected error value from "${query}", got ${typeof evalResult}`).toBe(true);
  return evalResult;
}

// [QSERR#site]
export async function expectErrorThrown(query, address) {
  const errorResult = await expectErrorResult(query);
  expect(errorResult.tag?.name).toBe(address);
  return errorResult;
}

export function expectOriginalError(errorValue, ErrorClass) {
  expect(errorValue.originalError).toBeInstanceOf(ErrorClass);
  return errorValue.originalError;
}

export async function catchOriginalError(query) {
  const evalResult = await evalQuery(query);
  return isErrorValue(evalResult) ? evalResult.originalError : null;
}

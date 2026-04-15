// Three-legged per-site assertion helper for the CLI operand tests.
//
// Every operand error site the cli binds lifts its throw onto the
// fail-track as a qlang error value. The lift stores the class name
// under the descriptor's `:thrown` keyword (for qlang-visible
// diagnostics — `!| /thrown` projects to `:OutSubjectNotString` and
// the like) and preserves the original JS instance in the opaque
// `originalError` slot on the error value (not qlang-visible — for
// host-boundary re-throwing and for these assertions).
//
// A disciplined per-site assertion pins three independent legs of
// the contract:
//
//   1. descriptor-visible class identity — `:thrown === :<ClassName>`
//      pins what qlang-side `!|` handlers can pattern-match on.
//   2. JS-side class identity — `errorValue.originalError instanceof
//      QlangTypeError` pins the inheritance root so every operand
//      throw is uniformly reachable by embedders who want to
//      catch type-errors generically. The per-site class name is
//      re-asserted on the instance (`originalError.name`) so the
//      descriptor keyword and the JS instance stay in sync.
//   3. structured context — `originalError.context` matches the
//      expected shape (operand + position + actualType, or the
//      declareShapeError site's custom payload).
//
// Context-shape drift (silent rename of a field a downstream catch
// block reads) fails leg 3. Descriptor/instance desync fails leg 1
// or 2.

import { expect } from 'vitest';
import { QlangTypeError, keyword } from '@kaluchi/qlang-core';

// expectOperandErrorThrown(cellEntry, expectedClassName, expectedContext)
//   → the JS error instance (for further ad-hoc assertions)
//
// `cellEntry.error` must be null (the throw was caught and lifted,
// not propagated as a parse/setup failure). `expectedContext` is a
// partial shape — only listed fields are checked, so a test can pin
// the per-site-significant subset without re-asserting invariants
// every site already shares.
export function expectOperandErrorThrown(cellEntry, expectedClassName, expectedContext) {
  expect(cellEntry.error, 'cellEntry.error must be null (throw is lifted onto fail-track)').toBeNull();
  const errorValue = cellEntry.result;
  expect(errorValue?.type, 'cellEntry.result must be an error value').toBe('error');

  const thrownKeyword = errorValue.descriptor.get(keyword('thrown'));
  expect(thrownKeyword?.type, ':thrown must be a keyword').toBe('keyword');
  expect(thrownKeyword.name).toBe(expectedClassName);

  const originalError = errorValue.originalError;
  expect(originalError, 'originalError must preserve the JS throw instance').toBeInstanceOf(QlangTypeError);
  expect(originalError.name).toBe(expectedClassName);
  expect(originalError.context).toMatchObject(expectedContext);

  return originalError;
}

// Predicates: subject-first comparisons and combinators.
//
// Equality (`eq`) uses the shared deepEqual from src/equality.mjs
// so it stays in sync with the conformance test runner. Ordering
// (`gt`/`lt`/`gte`/`lte`) flows through `ensureSameOrderingType`
// so heterogeneous comparisons surface as type errors instead of
// silent JS coercion (e.g. `gt("a", 5)` is no longer false; it
// throws).

import { valueOp, nullaryOp } from './dispatch.mjs';
import { ensureSameOrderingType } from './guards.mjs';
import { isTruthy } from '../types.mjs';
import { deepEqual } from '../equality.mjs';

export const eq = valueOp('eq', 2, (subject, value) => deepEqual(subject, value));

function ordering(name, predicate) {
  return valueOp(name, 2, (subject, threshold) => {
    ensureSameOrderingType(name, subject, threshold);
    return predicate(subject, threshold);
  });
}

export const gt  = ordering('gt',  (a, b) => a >  b);
export const lt  = ordering('lt',  (a, b) => a <  b);
export const gte = ordering('gte', (a, b) => a >= b);
export const lte = ordering('lte', (a, b) => a <= b);

export const and = valueOp('and', 2, (a, b) => isTruthy(a) && isTruthy(b));
export const or  = valueOp('or',  2, (a, b) => isTruthy(a) || isTruthy(b));

export const not = nullaryOp('not', (subject) => !isTruthy(subject));

// Predicates: subject-first comparisons and combinators.

import { valueOp, nullaryOp } from './dispatch.mjs';
import { isTruthy } from '../types.mjs';

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }
  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  if (typeof a === 'object' && a.type === 'keyword') {
    return b !== null && typeof b === 'object' && b.type === 'keyword' && a.name === b.name;
  }
  return false;
}

export const eq  = valueOp('eq',  2, (subject, value) => deepEqual(subject, value));
export const gt  = valueOp('gt',  2, (subject, threshold) => subject > threshold);
export const lt  = valueOp('lt',  2, (subject, threshold) => subject < threshold);
export const gte = valueOp('gte', 2, (subject, threshold) => subject >= threshold);
export const lte = valueOp('lte', 2, (subject, threshold) => subject <= threshold);

export const and = valueOp('and', 2, (a, b) => isTruthy(a) && isTruthy(b));
export const or  = valueOp('or',  2, (a, b) => isTruthy(a) || isTruthy(b));

export const not = nullaryOp('not', (subject) => !isTruthy(subject));

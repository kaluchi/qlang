// Vec operands.
//
// Reducers (Vec → Scalar) are nullary on the subject. Transformers
// (Vec → Vec) are nullary or higher-order. `filter` is the canonical
// higher-order operand: it receives the predicate lambda directly so
// it can invoke the lambda per element.

import { valueOp, higherOrderOp, nullaryOp, overloadedOp } from './dispatch.mjs';
import { ensureVec, ensureNumber, ensureNumberElement, ensureSameOrderingType } from './guards.mjs';
import { isVec, isQMap, isQSet, isTruthy, describeType, NIL } from '../types.mjs';
import { SubjectTypeError } from '../errors.mjs';

// ── Vec → Scalar reducers ──────────────────────────────────────
//
// `count` and `empty` are polymorphic across Vec, Set, and Map —
// they answer "how many elements?" / "is it empty?" regardless of
// the container shape. This matches the runtime catalog which
// lists both operands under Vec, Map, and Set.

function sizeOf(operand, container) {
  if (isVec(container)) return container.length;
  if (isQSet(container)) return container.size;
  if (isQMap(container)) return container.size;
  throw new SubjectTypeError(operand, 'Vec, Set, or Map', describeType(container), container);
}

export const count = nullaryOp('count', (container) => sizeOf('count', container));

export const empty = nullaryOp('empty', (container) => sizeOf('empty', container) === 0);

export const first = nullaryOp('first', (vec) => {
  ensureVec('first', vec);
  return vec.length === 0 ? NIL : vec[0];
});

export const last = nullaryOp('last', (vec) => {
  ensureVec('last', vec);
  return vec.length === 0 ? NIL : vec[vec.length - 1];
});

export const sum = nullaryOp('sum', (vec) => {
  ensureVec('sum', vec);
  let total = 0;
  for (let i = 0; i < vec.length; i++) {
    ensureNumberElement('sum', i, vec[i]);
    total += vec[i];
  }
  return total;
});

// reduceComparable — shared scaffold for min and max. Empty Vec
// returns nil. Non-empty: walks every pair through
// ensureSameOrderingType to surface type errors instead of silent
// JS coercion.
function reduceComparable(name, vec, pick) {
  ensureVec(name, vec);
  if (vec.length === 0) return NIL;
  let acc = vec[0];
  for (let i = 1; i < vec.length; i++) {
    const next = vec[i];
    ensureSameOrderingType(name, acc, next);
    acc = pick(acc, next) ? acc : next;
  }
  return acc;
}

export const min = nullaryOp('min', (vec) => reduceComparable('min', vec, (a, b) => a < b));
export const max = nullaryOp('max', (vec) => reduceComparable('max', vec, (a, b) => a > b));

// ── Vec → Vec transformers ─────────────────────────────────────

export const filter = higherOrderOp('filter', 2, (vec, predLambda) => {
  ensureVec('filter', vec);
  return vec.filter(item => isTruthy(predLambda(item)));
});

// sort — overloaded: 0 captured = natural order, 1 captured = key.
export const sort = overloadedOp('sort', 2, {
  0: (vec) => {
    ensureVec('sort', vec);
    return [...vec].sort((a, b) => {
      ensureSameOrderingType('sort', a, b);
      return compareScalars(a, b);
    });
  },
  1: (vec, keyLambda) => {
    ensureVec('sort', vec);
    return [...vec].sort((a, b) => {
      const ka = keyLambda(a);
      const kb = keyLambda(b);
      ensureSameOrderingType('sort', ka, kb);
      return compareScalars(ka, kb);
    });
  }
});

function compareScalars(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const take = valueOp('take', 2, (vec, n) => {
  ensureVec('take', vec);
  ensureNumber('take', 2, n);
  return vec.slice(0, n);
});

export const drop = valueOp('drop', 2, (vec, n) => {
  ensureVec('drop', vec);
  ensureNumber('drop', 2, n);
  return vec.slice(n);
});

export const distinct = nullaryOp('distinct', (vec) => {
  ensureVec('distinct', vec);
  const seen = new Set();
  const result = [];
  for (const v of vec) {
    if (!seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }
  return result;
});

export const reverse = nullaryOp('reverse', (vec) => {
  ensureVec('reverse', vec);
  return [...vec].reverse();
});

export const flat = nullaryOp('flat', (vec) => {
  ensureVec('flat', vec);
  const result = [];
  for (const item of vec) {
    if (isVec(item)) result.push(...item);
    else result.push(item);
  }
  return result;
});

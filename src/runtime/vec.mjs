// Vec operands.
//
// Reducers (Vec → Scalar) are nullary on subject. Transformers
// (Vec → Vec) are nullary or higher-order. `filter` is the
// canonical higher-order operand: it receives the predicate
// lambda directly so it can invoke it per element.

import { valueOp, higherOrderOp, nullaryOp } from './dispatch.mjs';
import { TypeError as QTypeError } from '../errors.mjs';
import { isVec, isTruthy, describeType, NIL } from '../types.mjs';

function ensureVec(name, value) {
  if (!isVec(value)) {
    throw new QTypeError(`${name} requires Vec subject, got ${describeType(value)}`);
  }
}

// ── Vec → Scalar reducers ──────────────────────────────────────

export const count = nullaryOp('count', (vec) => {
  ensureVec('count', vec);
  return vec.length;
});

export const empty = nullaryOp('empty', (vec) => {
  ensureVec('empty', vec);
  return vec.length === 0;
});

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
  for (const v of vec) {
    if (typeof v !== 'number') {
      throw new QTypeError(`sum requires numeric elements, got ${describeType(v)}`);
    }
    total += v;
  }
  return total;
});

export const min = nullaryOp('min', (vec) => {
  ensureVec('min', vec);
  if (vec.length === 0) return NIL;
  return vec.reduce((a, b) => a < b ? a : b);
});

export const max = nullaryOp('max', (vec) => {
  ensureVec('max', vec);
  if (vec.length === 0) return NIL;
  return vec.reduce((a, b) => a > b ? a : b);
});

// ── Vec → Vec transformers ─────────────────────────────────────

export const filter = higherOrderOp('filter', 2, (vec, predLambda) => {
  ensureVec('filter', vec);
  return vec.filter(item => isTruthy(predLambda(item)));
});

// sort — overloaded: 0 captured = natural order, 1 captured = key.
import { makeFn } from '../rule10.mjs';
import { ArityError } from '../errors.mjs';

export const sort = makeFn('sort', 2, (pipeValue, lambdas) => {
  ensureVec('sort', pipeValue);
  if (lambdas.length === 0) {
    return [...pipeValue].sort(compareValues);
  }
  if (lambdas.length === 1) {
    const keyLambda = lambdas[0];
    return [...pipeValue].sort((a, b) =>
      compareValues(keyLambda(a), keyLambda(b)));
  }
  throw new ArityError(`sort accepts 0 or 1 captured args, got ${lambdas.length}`);
});

function compareValues(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const take = valueOp('take', 2, (vec, n) => {
  ensureVec('take', vec);
  if (typeof n !== 'number') {
    throw new QTypeError(`take(n) requires numeric n, got ${describeType(n)}`);
  }
  return vec.slice(0, n);
});

export const drop = valueOp('drop', 2, (vec, n) => {
  ensureVec('drop', vec);
  if (typeof n !== 'number') {
    throw new QTypeError(`drop(n) requires numeric n, got ${describeType(n)}`);
  }
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

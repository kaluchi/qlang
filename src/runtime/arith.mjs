// Arithmetic operands. Subject-first: position 1 is the subject,
// positions 2..n are modifiers. All four support partial (one
// captured arg) and full (two captured args).

import { valueOp } from './dispatch.mjs';
import { TypeError as QTypeError, DivisionByZeroError } from '../errors.mjs';
import { describeType } from '../types.mjs';

function ensureNumber(name, position, value) {
  if (typeof value !== 'number') {
    throw new QTypeError(
      `${name} requires number at position ${position}, got ${describeType(value)}`
    );
  }
}

export const add = valueOp('add', 2, (a, b) => {
  ensureNumber('add', 1, a);
  ensureNumber('add', 2, b);
  return a + b;
});

export const sub = valueOp('sub', 2, (a, b) => {
  ensureNumber('sub', 1, a);
  ensureNumber('sub', 2, b);
  return a - b;
});

export const mul = valueOp('mul', 2, (a, b) => {
  ensureNumber('mul', 1, a);
  ensureNumber('mul', 2, b);
  return a * b;
});

export const div = valueOp('div', 2, (a, b) => {
  ensureNumber('div', 1, a);
  ensureNumber('div', 2, b);
  if (b === 0) throw new DivisionByZeroError();
  return a / b;
});

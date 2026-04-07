// Arithmetic operands. Subject-first: position 1 is the subject,
// positions 2..n are modifiers. All four support partial (one
// captured arg) and full (two captured args).

import { valueOp } from './dispatch.mjs';
import { ensureNumber } from './guards.mjs';
import { DivisionByZeroError } from '../errors.mjs';

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

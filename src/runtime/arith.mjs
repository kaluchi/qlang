// Arithmetic operands.
//
// Subject-first: position 1 is the subject, position 2 is the
// modifier. Each type check is inlined at its own throw site so
// the source file and line number plus the class name together
// uniquely identify the failing check.
//
// Meta (docs, examples, throws, category, subject, modifiers,
// returns) lives in manifest.qlang — not here.

import { valueOp } from './dispatch.mjs';
import { DivisionByZeroError } from '../errors.mjs';
import { describeType } from '../types.mjs';
import { declareModifierError } from '../operand-errors.mjs';

const AddLeftNotNumber  = declareModifierError('AddLeftNotNumber',  'add', 1, 'number');
const AddRightNotNumber = declareModifierError('AddRightNotNumber', 'add', 2, 'number');
const SubLeftNotNumber  = declareModifierError('SubLeftNotNumber',  'sub', 1, 'number');
const SubRightNotNumber = declareModifierError('SubRightNotNumber', 'sub', 2, 'number');
const MulLeftNotNumber  = declareModifierError('MulLeftNotNumber',  'mul', 1, 'number');
const MulRightNotNumber = declareModifierError('MulRightNotNumber', 'mul', 2, 'number');
const DivLeftNotNumber  = declareModifierError('DivLeftNotNumber',  'div', 1, 'number');
const DivRightNotNumber = declareModifierError('DivRightNotNumber', 'div', 2, 'number');

export const add = valueOp('add', 2, (a, b) => {
  if (typeof a !== 'number') throw new AddLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new AddRightNotNumber(describeType(b), b);
  return a + b;
});

export const sub = valueOp('sub', 2, (a, b) => {
  if (typeof a !== 'number') throw new SubLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new SubRightNotNumber(describeType(b), b);
  return a - b;
});

export const mul = valueOp('mul', 2, (a, b) => {
  if (typeof a !== 'number') throw new MulLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new MulRightNotNumber(describeType(b), b);
  return a * b;
});

export const div = valueOp('div', 2, (a, b) => {
  if (typeof a !== 'number') throw new DivLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new DivRightNotNumber(describeType(b), b);
  if (b === 0) throw new DivisionByZeroError();
  return a / b;
});

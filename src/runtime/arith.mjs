// Arithmetic operands.
//
// Subject-first: position 1 is the subject, position 2 is the
// modifier. Each type check is inlined at its own throw site so
// the source file and line number plus the class name together
// uniquely identify the failing check.

import { valueOp } from './dispatch.mjs';
import { DivisionByZeroError } from '../errors.mjs';
import { describeType } from '../types.mjs';
import { declareModifierError } from './operand-errors.mjs';

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
}, {
  category: 'arith',
  subject: 'number',
  modifiers: ['number'],
  returns: 'number',
  docs: ['Adds two numbers. Bound form `a | add(b)` computes a+b; full form `add(a,b)` resolves both args against pipeValue context.'],
  examples: ['10 | add(3) → 13', '{:x 10 :y 3} | add(/x, /y) → 13'],
  throws: ['AddLeftNotNumber', 'AddRightNotNumber']
});

export const sub = valueOp('sub', 2, (a, b) => {
  if (typeof a !== 'number') throw new SubLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new SubRightNotNumber(describeType(b), b);
  return a - b;
}, {
  category: 'arith',
  subject: 'number',
  modifiers: ['number'],
  returns: 'number',
  docs: ['Subtracts the second number from the first. Non-commutative: position 1 is the minuend.'],
  examples: ['10 | sub(3) → 7', '{:x 10 :y 3} | sub(/x, /y) → 7'],
  throws: ['SubLeftNotNumber', 'SubRightNotNumber']
});

export const mul = valueOp('mul', 2, (a, b) => {
  if (typeof a !== 'number') throw new MulLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new MulRightNotNumber(describeType(b), b);
  return a * b;
}, {
  category: 'arith',
  subject: 'number',
  modifiers: ['number'],
  returns: 'number',
  docs: ['Multiplies two numbers. Commutative.'],
  examples: ['10 | mul(3) → 30', '{:x 5 :y 4} | mul(/x, /y) → 20'],
  throws: ['MulLeftNotNumber', 'MulRightNotNumber']
});

export const div = valueOp('div', 2, (a, b) => {
  if (typeof a !== 'number') throw new DivLeftNotNumber(describeType(a), a);
  if (typeof b !== 'number') throw new DivRightNotNumber(describeType(b), b);
  if (b === 0) throw new DivisionByZeroError();
  return a / b;
}, {
  category: 'arith',
  subject: 'number',
  modifiers: ['number'],
  returns: 'number',
  docs: ['Divides the first number by the second. Non-commutative: position 1 is the dividend. Raises division-by-zero on b == 0.'],
  examples: ['10 | div(2) → 5', '{:x 20 :y 4} | div(/x, /y) → 5'],
  throws: ['DivLeftNotNumber', 'DivRightNotNumber', 'DivisionByZeroError']
});

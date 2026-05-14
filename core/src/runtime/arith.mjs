// Arithmetic operands.
//
// Subject-first: position 1 is the subject, position 2 is the
// modifier. Each type check is inlined at its own throw site so
// the source file and line number plus the class name together
// uniquely identify the failing check.
//
// Meta lives in lib/qlang/operand/arith.qlang.

import { valueOp } from './dispatch.mjs';
import { DivisionByZeroError } from '../errors.mjs';
import { declareModifierError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const AddLeftNotNumberError  = declareModifierError('AddLeftNotNumberError',  'add', 1, 'number');
const AddRightNotNumberError = declareModifierError('AddRightNotNumberError', 'add', 2, 'number');
const SubLeftNotNumberError  = declareModifierError('SubLeftNotNumberError',  'sub', 1, 'number');
const SubRightNotNumberError = declareModifierError('SubRightNotNumberError', 'sub', 2, 'number');
const MulLeftNotNumberError  = declareModifierError('MulLeftNotNumberError',  'mul', 1, 'number');
const MulRightNotNumberError = declareModifierError('MulRightNotNumberError', 'mul', 2, 'number');
const DivLeftNotNumberError  = declareModifierError('DivLeftNotNumberError',  'div', 1, 'number');
const DivRightNotNumberError = declareModifierError('DivRightNotNumberError', 'div', 2, 'number');

export const add = valueOp('add', 2, (a, b) => {
  if (typeof a !== 'number') throw new AddLeftNotNumberError(a);
  if (typeof b !== 'number') throw new AddRightNotNumberError(b);
  return a + b;
});

export const sub = valueOp('sub', 2, (a, b) => {
  if (typeof a !== 'number') throw new SubLeftNotNumberError(a);
  if (typeof b !== 'number') throw new SubRightNotNumberError(b);
  return a - b;
});

export const mul = valueOp('mul', 2, (a, b) => {
  if (typeof a !== 'number') throw new MulLeftNotNumberError(a);
  if (typeof b !== 'number') throw new MulRightNotNumberError(b);
  return a * b;
});

export const div = valueOp('div', 2, (a, b) => {
  if (typeof a !== 'number') throw new DivLeftNotNumberError(a);
  if (typeof b !== 'number') throw new DivRightNotNumberError(b);
  if (b === 0) throw new DivisionByZeroError();
  return a / b;
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/add', add);
PRIMITIVE_REGISTRY.bind('qlang/prim/sub', sub);
PRIMITIVE_REGISTRY.bind('qlang/prim/mul', mul);
PRIMITIVE_REGISTRY.bind('qlang/prim/div', div);

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
import { declareModifierError, declareShapeError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const AddLeftNotNumberError  = declareModifierError('AddLeftNotNumberError',  'add', 1, 'number');
const AddRightNotNumberError = declareModifierError('AddRightNotNumberError', 'add', 2, 'number');
const SubLeftNotNumberError  = declareModifierError('SubLeftNotNumberError',  'sub', 1, 'number');
const SubRightNotNumberError = declareModifierError('SubRightNotNumberError', 'sub', 2, 'number');
const MulLeftNotNumberError  = declareModifierError('MulLeftNotNumberError',  'mul', 1, 'number');
const MulRightNotNumberError = declareModifierError('MulRightNotNumberError', 'mul', 2, 'number');
const DivLeftNotNumberError  = declareModifierError('DivLeftNotNumberError',  'div', 1, 'number');
const DivRightNotNumberError = declareModifierError('DivRightNotNumberError', 'div', 2, 'number');

// A qlang Number is a finite double. Both operands are finite by
// that same rule, so the only way past the range is the operation
// itself, and the per-site class lifts the overflow onto the
// fail-track — the choice `div(0)` already makes for the other
// non-finite source. Without it the pipeline would carry a value
// no literal renders back, that orders against nothing, and that
// the JSON boundary turns into `null`.
const AddResultNotFiniteError = declareShapeError('AddResultNotFiniteError',
  ({ leftValue, rightValue }) => `add(${leftValue}, ${rightValue}) leaves the finite double range`);
const SubResultNotFiniteError = declareShapeError('SubResultNotFiniteError',
  ({ leftValue, rightValue }) => `sub(${leftValue}, ${rightValue}) leaves the finite double range`);
const MulResultNotFiniteError = declareShapeError('MulResultNotFiniteError',
  ({ leftValue, rightValue }) => `mul(${leftValue}, ${rightValue}) leaves the finite double range`);
const DivResultNotFiniteError = declareShapeError('DivResultNotFiniteError',
  ({ leftValue, rightValue }) => `div(${leftValue}, ${rightValue}) leaves the finite double range`);

// The operands ride the descriptor as `:leftValue` / `:rightValue`
// — both finite, so the error value itself stays renderable, where
// stamping the overflowed result would plant the very shape this
// site refuses.
function finiteResultOf(result, leftValue, rightValue, ErrorCls) {
  if (!Number.isFinite(result)) throw new ErrorCls({ leftValue, rightValue });
  return result;
}

export const add = valueOp('add', 2, (a, b) => {
  if (typeof a !== 'number') throw new AddLeftNotNumberError(a);
  if (typeof b !== 'number') throw new AddRightNotNumberError(b);
  return finiteResultOf(a + b, a, b, AddResultNotFiniteError);
});

export const sub = valueOp('sub', 2, (a, b) => {
  if (typeof a !== 'number') throw new SubLeftNotNumberError(a);
  if (typeof b !== 'number') throw new SubRightNotNumberError(b);
  return finiteResultOf(a - b, a, b, SubResultNotFiniteError);
});

export const mul = valueOp('mul', 2, (a, b) => {
  if (typeof a !== 'number') throw new MulLeftNotNumberError(a);
  if (typeof b !== 'number') throw new MulRightNotNumberError(b);
  return finiteResultOf(a * b, a, b, MulResultNotFiniteError);
});

export const div = valueOp('div', 2, (a, b) => {
  if (typeof a !== 'number') throw new DivLeftNotNumberError(a);
  if (typeof b !== 'number') throw new DivRightNotNumberError(b);
  if (b === 0) throw new DivisionByZeroError();
  return finiteResultOf(a / b, a, b, DivResultNotFiniteError);
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('add', add);
bindPrim('sub', sub);
bindPrim('mul', mul);
bindPrim('div', div);

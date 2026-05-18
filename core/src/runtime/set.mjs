// Set operands. The polymorphic `count`, `empty`, `has` live in
// vec.mjs / map.mjs respectively. This file holds the Vec→Set
// conversion.
//
// Meta lives in lib/qlang/operand/set-op.qlang.

import { nullaryOp } from './dispatch.mjs';
import { isVec } from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const SetConversionSubjectNotVecError = declareSubjectError('SetConversionSubjectNotVecError', 'set', 'vec');

export const set = nullaryOp('set', (vec) => {
  if (!isVec(vec)) throw new SetConversionSubjectNotVecError(vec);
  return new Set(vec);
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('set', set);

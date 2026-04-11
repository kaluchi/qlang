// Set operands. The polymorphic `count`, `empty`, `has` live in
// vec.mjs / map.mjs respectively. This file holds the Vec→Set
// conversion.
//
// Meta lives in manifest.qlang.

import { nullaryOp } from './dispatch.mjs';
import { isVec, describeType, keyword } from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const SetConversionSubjectNotVec = declareSubjectError('SetConversionSubjectNotVec', 'set', 'Vec');

export const set = nullaryOp('set', (vec) => {
  if (!isVec(vec)) throw new SetConversionSubjectNotVec(describeType(vec), vec);
  return new Set(vec);
});

// Variant-B primitive registry bindings — coexist with IMPLS.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/set'), set);

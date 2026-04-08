// Set operands. The polymorphic `count`, `empty`, `has` live in
// vec.mjs / map.mjs respectively. This file holds the Vec→Set
// conversion and any future Set-only operands.

import { nullaryOp } from './dispatch.mjs';
import { isVec, describeType } from '../types.mjs';
import { declareSubjectError } from './operand-errors.mjs';

const SetConversionSubjectNotVec = declareSubjectError('SetConversionSubjectNotVec', 'set', 'Vec');

export const set = nullaryOp('set', (vec) => {
  if (!isVec(vec)) throw new SetConversionSubjectNotVec(describeType(vec), vec);
  return new Set(vec);
}, {
  category: 'set-op',
  subject: 'Vec',
  modifiers: [],
  returns: 'Set',
  docs: ['Converts a Vec to a Set, removing duplicates.'],
  examples: ['[1 2 1 3] | set → #{1 2 3}'],
  throws: ['SetConversionSubjectNotVec']
});

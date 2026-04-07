// Set operands. The polymorphic `has` and `count` are exported
// from map.mjs / vec.mjs respectively. This file holds the Vec→Set
// conversion `set` and any future Set-only operands.

import { nullaryOp } from './dispatch.mjs';
import { TypeError as QTypeError } from '../errors.mjs';
import { isVec, describeType } from '../types.mjs';

export const set = nullaryOp('set', (vec) => {
  if (!isVec(vec)) {
    throw new QTypeError(`set requires Vec subject, got ${describeType(vec)}`);
  }
  return new Set(vec);
});

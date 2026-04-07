// Set operands. The polymorphic `has` and `count` are exported
// from map.mjs / vec.mjs respectively. This file holds the Vec→Set
// conversion `set` and any future Set-only operands.

import { nullaryOp } from './dispatch.mjs';
import { ensureVec } from './guards.mjs';

export const set = nullaryOp('set', (vec) => {
  ensureVec('set', vec);
  return new Set(vec);
});

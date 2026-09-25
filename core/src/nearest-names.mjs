// The names an unresolved name was likely meant to be [D7]: the names
// of the value namespace within an edit distance of a third of the
// typed name's length, one at least, and of those the nearest alone,
// in the order of their spelling. An edit is an insertion, a deletion,
// a substitution or a swap of two neighbours, the slips of a typing
// hand.

import { keyword } from './types.mjs';
import { isTagBindingName, isRuntimeKey } from './env-keys.mjs';

function editDistance(typed, known) {
  const table = Array.from({ length: typed.length + 1 }, () => new Array(known.length + 1).fill(0));
  for (let row = 0; row <= typed.length; row++) table[row][0] = row;
  for (let col = 0; col <= known.length; col++) table[0][col] = col;
  for (let row = 1; row <= typed.length; row++) {
    for (let col = 1; col <= known.length; col++) {
      const substitution = typed[row - 1] === known[col - 1] ? 0 : 1;
      table[row][col] = Math.min(
        table[row - 1][col] + 1,
        table[row][col - 1] + 1,
        table[row - 1][col - 1] + substitution);
      const swapped = row > 1 && col > 1
        && typed[row - 1] === known[col - 2] && typed[row - 2] === known[col - 1];
      if (swapped) table[row][col] = Math.min(table[row][col], table[row - 2][col - 2] + 1);
    }
  }
  return table[typed.length][known.length];
}

// A name of the value namespace: no tag's, and none of the keys the
// runtime keeps for itself.
function isValueName(envKey) {
  return !isTagBindingName(envKey) && !isRuntimeKey(envKey);
}

export function nearestNames(env, typedName) {
  let nearest = [];
  let nearestDistance = Math.floor(Math.max(typedName.length, 3) / 3);
  for (const envKey of env.keys()) {
    if (!isValueName(envKey)) continue;
    const distance = editDistance(typedName, envKey);
    if (distance > nearestDistance) continue;
    if (distance < nearestDistance) {
      nearest = [];
      nearestDistance = distance;
    }
    nearest.push(envKey);
  }
  return Object.freeze(nearest.sort().map(name => keyword(name)));
}

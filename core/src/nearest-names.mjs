// The names an unresolved name was likely meant to be [D7]: the names
// of the value namespace within an edit distance of a third of the
// typed name's length, one at least, and of those the nearest alone,
// in the order of their spelling. An edit is an insertion, a deletion,
// a substitution or a swap of two neighbours, the slips of a typing
// hand; beside them, the names one of which begins the other.

import { keyword, makeTagKeyword } from './types.mjs';
import { isTagBindingName, isRuntimeKey, stripTagBindingPrefix } from './env-keys.mjs';

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

// One name begins the other, three letters at least: the guess of a longer
// or a shorter name for the same act, `multiply` for `mul` [D118].
const PREFIX_LETTERS = 3;
function beginsTheOther(typed, known) {
  return Math.min(typed.length, known.length) >= PREFIX_LETTERS && (typed.startsWith(known) || known.startsWith(typed));
}

// The nearest of the names, those within a slip of the hand, the nearest
// alone, and beside them those that begin the typed name or that it
// begins, in the order of their spelling.
function nearestOf(names, typedName) {
  let nearest = [];
  let nearestDistance = Math.floor(Math.max(typedName.length, 3) / 3);
  const begun = new Set();
  for (const name of names) {
    if (beginsTheOther(typedName, name) && name !== typedName) begun.add(name);
    const distance = editDistance(typedName, name);
    if (distance > nearestDistance) continue;
    if (distance < nearestDistance) {
      nearest = [];
      nearestDistance = distance;
    }
    nearest.push(name);
  }
  return [...new Set([...nearest, ...begun])].sort();
}

export function nearestNames(env, typedName) {
  return Object.freeze(nearestOf([...env.keys()].filter(isValueName), typedName).map(name => keyword(name)));
}

// The tags an unknown tag name was likely meant to be [D118].
export function nearestTagNames(env, typedName) {
  const tagNames = [...env.keys()].filter(isTagBindingName).map(stripTagBindingPrefix);
  return Object.freeze(nearestOf(tagNames, typedName).map(name => makeTagKeyword(name)));
}

// The primitives of the keys of a map and of membership, whose words the
// catalog declares under `::map`, `::set` and `::vec` [QSQUO#modifier].

import { keyword, isKeyword, isPath, makeSet } from '../types.mjs';
import { pathReads } from './path.mjs';
import { bindPrim } from '../primitives.mjs';
import { compareValues } from '../ordering.mjs';

bindPrim('map/keys', map => makeSet([...map.keys()].map(keyword)));
bindPrim('map/vals', map => [...map.values()]);
bindPrim('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([keyword(entryKey), entryValue])));

// Whether a set holds a value, by a search in the one order, which ranks
// two values alike exactly when they are equal [QSORD#order].
function setHas(set, value) {
  let low = 0;
  let high = set.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const byOrder = compareValues(set[middle], value);
    if (byOrder === 0) return true;
    if (byOrder < 0) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

// `has` asks whether a path reads, and of any other value whether it is
// held [QSPTH#value]; `contains` asks the membership alone.
const vecHolds = (vector, element) => vector.some(held => compareValues(held, element) === 0);
bindPrim('vec/has', (vector, element) => (isPath(element) ? pathReads(vector, element) : vecHolds(vector, element)));
bindPrim('vec/contains', vecHolds);
bindPrim('set/has', (set, element) => (isPath(element) ? pathReads(set, element) : setHas(set, element)));
bindPrim('set/contains', (set, element) => setHas(set, element));
// A map's key is named by a keyword or a string alike.
bindPrim('map/has', (map, key) => (isPath(key) ? pathReads(map, key) : map.has(isKeyword(key) ? key.name : key)));

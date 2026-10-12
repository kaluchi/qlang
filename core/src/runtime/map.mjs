// The primitives of the keys of a map and of membership, whose words the
// catalog declares under `::map`, `::set` and `::vec` [D167].

import { keyword, isKeyword, makeSet } from '../types.mjs';
import { bindPrim } from '../primitives.mjs';
import { compareValues } from '../ordering.mjs';

bindPrim('map/keys', map => makeSet([...map.keys()].map(keyword)));
bindPrim('map/vals', map => [...map.values()]);
bindPrim('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([keyword(entryKey), entryValue])));

// Whether a set holds a value, by a search in the one order, which ranks
// two values alike exactly when they are equal [D16].
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

bindPrim(['vec/has', 'vec/contains'], (vector, element) => vector.some(held => compareValues(held, element) === 0));
bindPrim(['set/has', 'set/contains'], (set, element) => setHas(set, element));
// A map's key is named by a keyword or a string alike.
bindPrim('map/has', (map, key) => map.has(isKeyword(key) ? key.name : key));

// The primitives of the keys of a map and of membership, whose words the
// catalog declares under `::map` and `::vec` [QSQUO#modifier].

import { keyword, isKeyword, isPath, isSet, makeSet } from '../types.mjs';
import { pathReads } from './path.mjs';
import { bindPrim } from '../primitives.mjs';
import { compareValues } from '../ordering.mjs';

bindPrim('map/keys', map => makeSet([...map.keys()].map(keyword)));
bindPrim('map/vals', map => [...map.values()]);
bindPrim('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([keyword(entryKey), entryValue])));

// Whether a vector holds a value equal to the element: a set by a search in
// its one order, which ranks two values alike exactly when they are equal,
// and any other vector element by element [QSORD#order], [D355].
function containsElement(vector, element) {
  if (!isSet(vector)) return vector.some(held => compareValues(held, element) === 0);
  let low = 0;
  let high = vector.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const byOrder = compareValues(vector[middle], element);
    if (byOrder === 0) return true;
    if (byOrder < 0) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

// `has` asks whether a path reads, and of any other value whether it is
// held [QSPTH#has]; `contains` asks the membership alone.
bindPrim('vec/has', (vector, element) => (isPath(element) ? pathReads(vector, element) : containsElement(vector, element)));
bindPrim('vec/contains', containsElement);
// A map's key is named by a keyword, a string or a number alike, the
// number by its text, as `get` reads it [QSPTH#has].
bindPrim('map/has', (map, key) => (isPath(key) ? pathReads(map, key) : map.has(isKeyword(key) ? key.name : String(key))));

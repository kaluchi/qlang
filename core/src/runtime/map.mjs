// The names of the keys of a map and of membership, each a plain
// function over the subject and the parts of its args [D167]: `keys`,
// `vals` and `entries` reside on `::map`, and `has` on `::map`, whose key
// is a keyword or a string, and on `::set` and `::vec`, whose element is
// any value.
//
// The verbs live in lib/qlang/map.qlang and set.qlang.

import { keyword, isKeyword, makeSet } from '../types.mjs';
import { bindPrim } from '../primitives.mjs';
import { compareValues } from '../ordering.mjs';

// `keys` answers a map's keys as the sorted Set of keywords [D15]
// and `vals` its values as a Vec, in the order of the entries.
bindPrim('map/keys', map => makeSet([...map.keys()].map(keyword)));
bindPrim('map/vals', map => [...map.values()]);

// `entries` answers a map as the vector of its pairs `[key value]` in the
// order of the entries, the key a keyword, the way `[type payload]`
// splits a tagged value; `::map` builds the map back [D138].
bindPrim('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([keyword(entryKey), entryValue])));

// `has` is a boolean lookup: over a map a keyword and a string both
// name the key as the map stores it, so the `keys | first | :k / | src |
// has k` chain composes without a coercion; over a set, membership is a
// binary search in the one order, which ranks two values alike exactly
// when they are equal [D16]; over a vector, an element equal to it in
// that order, found by a walk [D107].
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
bindPrim('map/has', (map, key) => map.has(isKeyword(key) ? key.name : key));

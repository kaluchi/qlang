// The verbs of the keys of a map and of membership, each a plain
// function over the value the head of its verb checked [D72]: `keys`
// and `vals` reside on `::map`, and `has` on `::map`, whose key is a
// keyword or a string, and on `::set`, whose element is any value.
//
// The verbs live in lib/qlang/map.qlang and set.qlang.

import { keyword, isKeyword, isQMap, makeSet } from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { compareValues } from '../ordering.mjs';

// The refusals the heads raise at the places they declare; the key of
// `has` is the map's alone, the element of a set being any value [D73].
declareSubjectError('KeysSubjectNotMapError', 'keys', 'map');
declareSubjectError('ValsSubjectNotMapError', 'vals', 'map');
declareModifierError('HasKeyNotKeywordOrStringError', '::map/has', 2, ['keyword', 'string']);

// `keys` answers a map's keys as the sorted Set of keywords [D15]
// and `vals` its values as a Vec, in the order of the entries.
bindPrim('keys', map => makeSet([...map.keys()].map(keyword)));
bindPrim('vals', map => [...map.values()]);

// `has` is a boolean lookup: over a map a keyword and a string both
// name the key as the map stores it, so the `keys | first | :k / | src |
// has k` chain composes without a coercion; over a set, membership is a
// binary search in the one order, which ranks two values alike exactly
// when they are equal [D16].
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

bindPrim('has', (container, place) =>
  (isQMap(container) ? container.has(isKeyword(place) ? place.name : place) : setHas(container, place)));

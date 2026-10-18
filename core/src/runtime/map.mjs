// The primitives of the keys, the values and the entries of a map, whose verbs
// the catalog declares under `::map` [QSCOL#map].

import { keyword, isKeyword, isPath } from '../types.mjs';
import { makeSet } from '../ordering.mjs';
import { pathReads } from './path.mjs';
import { registerPrimitive } from '../primitives.mjs';

registerPrimitive('map/keys', map => makeSet([...map.keys()].map(keyword)));
registerPrimitive('map/vals', map => [...map.values()]);
registerPrimitive('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([keyword(entryKey), entryValue])));

// A map's key is named by a keyword, a string or a number alike, the
// number by its text, as `get` reads it [QSPTH#has].
registerPrimitive('map/has', (map, key) => (isPath(key) ? pathReads(map, key) : map.has(isKeyword(key) ? key.name : String(key))));

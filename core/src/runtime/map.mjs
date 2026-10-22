// [QSCOL#map]

import { keyword, isPath } from '../types.mjs';
import { makeSet } from '../ordering.mjs';
import { keyNameOf } from '../path-read.mjs';
import { pathReads } from './path.mjs';
import { registerPrimitive } from '../primitives.mjs';

registerPrimitive('map/keys', map => makeSet([...map.keys()].map(keyword)));
registerPrimitive('map/vals', map => [...map.values()]);
registerPrimitive('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([keyword(entryKey), entryValue])));

// [QSPTH#has]
registerPrimitive('map/has', (map, key) => (isPath(key) ? pathReads(map, key) : map.has(keyNameOf(key))));

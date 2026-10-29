// [QSCOL#map]

import { makeKeyword, isPath } from '../types.mjs';
import { keyNameOf } from '../path-read.mjs';
import { pathReads } from './path-primitives.mjs';
import { registerPrimitive } from '../primitives.mjs';

registerPrimitive('map/keys', map => [...map.keys()].map(makeKeyword));
registerPrimitive('map/vals', map => [...map.values()]);
registerPrimitive('map/entries', map => [...map].map(([entryKey, entryValue]) => Object.freeze([makeKeyword(entryKey), entryValue])));

// [QSPTH#has]
registerPrimitive('map/has', (map, key) => (isPath(key) ? pathReads(map, key) : map.has(keyNameOf(key))));

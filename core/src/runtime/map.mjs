// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Meta lives in lib/qlang/operand/mapOp.qlang.

import { nullaryOp, valueOp } from './dispatch.mjs';
import {
  keyword, isQSet, isKeyword, isQMap, makeSet
} from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';
import { compareValues } from '../ordering.mjs';

const KeysSubjectNotMapError       = declareSubjectError('KeysSubjectNotMapError',       'keys', 'map');
const ValsSubjectNotMapError       = declareSubjectError('ValsSubjectNotMapError',       'vals', 'map');
const HasSubjectNotMapOrSetError   = declareSubjectError('HasSubjectNotMapOrSetError',   'has',  ['map', 'set']);
const HasKeyNotKeywordOrStringError = declareModifierError('HasKeyNotKeywordOrStringError', 'has', 2, ['keyword', 'string']);

// `keys` answers a map's keys as the sorted Set of keywords [D15]
// and `vals` its values as a Vec, in the order of the entries.
export const keys = nullaryOp('keys', (map) => {
  if (!isQMap(map)) throw new KeysSubjectNotMapError(map);
  return makeSet([...map.keys()].map(keyword));
});

export const vals = nullaryOp('vals', (map) => {
  if (!isQMap(map)) throw new ValsSubjectNotMapError(map);
  const out = [];
  for (const [, v] of map) out.push(v);
  return out;
});

// `has` is a boolean lookup — no key-back-into-container roundtrip,
// so the captured-arg shape can be either Keyword or String over
// a map (both normalise to the storage-side String via `key.name`
// or identity). The `keys | first | as :k | src | has k` chain
// composes without a coercion. Over a set, membership is a binary
// search in the one order, which ranks two values alike exactly when
// they are equal [D16].
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

export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    let lookupKey;
    if (isKeyword(key)) lookupKey = key.name;
    else if (typeof key === 'string') lookupKey = key;
    else throw new HasKeyNotKeywordOrStringError(key);
    return subject.has(lookupKey);
  }
  if (isQSet(subject)) return setHas(subject, key);
  throw new HasSubjectNotMapOrSetError(subject);
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('keys', keys);
bindPrim('vals', vals);
bindPrim('has',  has);

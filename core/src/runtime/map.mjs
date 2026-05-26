// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Meta lives in lib/qlang/operand/mapOp.qlang.

import { nullaryOp, valueOp } from './dispatch.mjs';
import {
  keyword, isQSet, isKeyword,
  isMapShape, mapShapeEntries, mapShapeHas,
  isJsonObject, makeJsonArray
} from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

const KeysSubjectNotMapError       = declareSubjectError('KeysSubjectNotMapError',       'keys', 'map');
const ValsSubjectNotMapError       = declareSubjectError('ValsSubjectNotMapError',       'vals', 'map');
const HasSubjectNotMapOrSetError   = declareSubjectError('HasSubjectNotMapOrSetError',   'has',  ['map', 'set']);
const HasKeyNotKeywordOrStringError = declareModifierError('HasKeyNotKeywordOrStringError', 'has', 2, ['keyword', 'string']);

// `keys` and `vals` preserve the source's value-class plane:
// a JsonObject extracts to JsonArrays of JSON-side data (strings
// for keys, raw values for vals — JSON in, JSON out, no qlang-only
// container surfaces in the result); a qlang Map extracts to a Set
// of Keyword keys (uniqueness invariant explicit in the
// value-class signal) and a Vec of values. The two key shapes —
// keyword on qlang Map, string on JsonObject — match the
// storage-side encoding directly; round-trip through
// `union`/`inter`/`minus` reconstructs the same value-class on
// either branch.
export const keys = nullaryOp('keys', (map) => {
  if (!isMapShape(map)) throw new KeysSubjectNotMapError(map);
  if (isJsonObject(map)) {
    const out = [];
    for (const [k] of mapShapeEntries(map)) out.push(k);
    return makeJsonArray(out);
  }
  const result = new Set();
  for (const [k] of mapShapeEntries(map)) result.add(keyword(k));
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isMapShape(map)) throw new ValsSubjectNotMapError(map);
  const out = [];
  for (const [, v] of mapShapeEntries(map)) out.push(v);
  return isJsonObject(map) ? makeJsonArray(out) : out;
});

// `has` is a boolean lookup — no key-back-into-container roundtrip,
// so the captured-arg shape can be either Keyword or String over
// every Map-shape subject (both normalise to the storage-side
// String via `key.name`/identity, matching `mapShapeHas`). The
// `keys | first | as(:k) | src | has(k)` chain composes through
// either source without an inter-shape coercion. Set subject
// keeps structural membership — Keyword elements compare by
// name, every other shape by ref/value.
export const has = valueOp('has', 2, (subject, key) => {
  if (isMapShape(subject)) {
    let lookupKey;
    if (isKeyword(key)) lookupKey = key.name;
    else if (typeof key === 'string') lookupKey = key;
    else throw new HasKeyNotKeywordOrStringError(key);
    return mapShapeHas(subject, lookupKey);
  }
  if (isQSet(subject)) {
    if (isKeyword(key)) {
      for (const v of subject) if (isKeyword(v) && v.name === key.name) return true;
      return false;
    }
    return subject.has(key);
  }
  throw new HasSubjectNotMapOrSetError(subject);
});

// Bind into PRIMITIVE_REGISTRY under qlang/prim/<name> at module-load time.
bindPrim('keys', keys);
bindPrim('vals', vals);
bindPrim('has',  has);

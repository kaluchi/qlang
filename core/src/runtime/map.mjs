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

const KeysSubjectNotMapError    = declareSubjectError('KeysSubjectNotMapError',    'keys',  'map');
const ValsSubjectNotMapError    = declareSubjectError('ValsSubjectNotMapError',    'vals',  'map');
const HasSubjectNotMapOrSetError = declareSubjectError('HasSubjectNotMapOrSetError', 'has',   ['map', 'set']);
const HasKeyNotKeywordError     = declareModifierError('HasKeyNotKeywordError',    'has',   2, 'keyword');

// `keys` and `vals` preserve the JSON-shape signal: a JsonObject
// subject keeps its sub-shape on the produced collection. Keys mint
// as plain Strings (the JSON-side key shape — round-trip through
// `union`/`inter`/`minus` reconstructs the original JsonObject) and
// vals mint as a JsonArray (uniformity with `filter`/`sort`/`take`
// over a JsonArray subject — JSON-shape stays in JSON across every
// shape-preserving operand). A qlang Map subject keeps keyword keys
// in the Set and a Vec of vals; the keyword-vs-string discriminator
// matches the source's key shape exactly.
export const keys = nullaryOp('keys', (map) => {
  if (!isMapShape(map)) throw new KeysSubjectNotMapError(map);
  const sourceIsJsonObject = isJsonObject(map);
  const result = new Set();
  for (const [k] of mapShapeEntries(map)) {
    result.add(sourceIsJsonObject ? k : keyword(k));
  }
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isMapShape(map)) throw new ValsSubjectNotMapError(map);
  const out = [];
  for (const [, v] of mapShapeEntries(map)) out.push(v);
  return isJsonObject(map) ? makeJsonArray(out) : out;
});

export const has = valueOp('has', 2, (subject, key) => {
  if (isMapShape(subject)) {
    if (!isKeyword(key)) throw new HasKeyNotKeywordError(key);
    return mapShapeHas(subject, key.name);
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

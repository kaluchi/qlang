// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Meta lives in lib/qlang/core.qlang.

import { nullaryOp, valueOp } from './dispatch.mjs';
import {
  keyword, isQSet, isKeyword,
  isMapShape, mapShapeEntries, mapShapeHas
} from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const KeysSubjectNotMap    = declareSubjectError('KeysSubjectNotMap',    'keys',  'map');
const ValsSubjectNotMap    = declareSubjectError('ValsSubjectNotMap',    'vals',  'map');
const HasSubjectNotMapOrSet = declareSubjectError('HasSubjectNotMapOrSet', 'has',   ['map', 'set']);
const HasKeyNotKeyword     = declareModifierError('HasKeyNotKeyword',    'has',   2, 'keyword');

export const keys = nullaryOp('keys', (map) => {
  if (!isMapShape(map)) throw new KeysSubjectNotMap(map);
  const result = new Set();
  for (const [k] of mapShapeEntries(map)) result.add(keyword(k));
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isMapShape(map)) throw new ValsSubjectNotMap(map);
  const out = [];
  for (const [, v] of mapShapeEntries(map)) out.push(v);
  return out;
});

export const has = valueOp('has', 2, (subject, key) => {
  if (isMapShape(subject)) {
    if (!isKeyword(key)) throw new HasKeyNotKeyword(key);
    return mapShapeHas(subject, key.name);
  }
  if (isQSet(subject)) {
    if (isKeyword(key)) {
      for (const v of subject) if (isKeyword(v) && v.name === key.name) return true;
      return false;
    }
    return subject.has(key);
  }
  throw new HasSubjectNotMapOrSet(subject);
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/keys', keys);
PRIMITIVE_REGISTRY.bind('qlang/prim/vals', vals);
PRIMITIVE_REGISTRY.bind('qlang/prim/has',  has);

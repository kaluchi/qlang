// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Meta lives in lib/qlang/core.qlang.

import { nullaryOp, valueOp } from './dispatch.mjs';
import { keyword, isQMap, isQSet, isKeyword, describeType } from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const KeysSubjectNotMap    = declareSubjectError('KeysSubjectNotMap',    'keys',  'Map');
const ValsSubjectNotMap    = declareSubjectError('ValsSubjectNotMap',    'vals',  'Map');
const HasSubjectNotMapOrSet = declareSubjectError('HasSubjectNotMapOrSet', 'has',   'Map or Set');
const HasKeyNotKeyword     = declareModifierError('HasKeyNotKeyword',    'has',   2, 'Keyword (Map subject)');

export const keys = nullaryOp('keys', (map) => {
  if (!isQMap(map)) throw new KeysSubjectNotMap(describeType(map), map);
  const result = new Set();
  for (const k of map.keys()) result.add(keyword(k));
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isQMap(map)) throw new ValsSubjectNotMap(describeType(map), map);
  return [...map.values()];
});

export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    if (!isKeyword(key)) throw new HasKeyNotKeyword(describeType(key), key);
    return subject.has(key.name);
  }
  if (isQSet(subject)) {
    if (isKeyword(key)) {
      for (const v of subject) if (isKeyword(v) && v.name === key.name) return true;
      return false;
    }
    return subject.has(key);
  }
  throw new HasSubjectNotMapOrSet(describeType(subject), subject);
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/keys', keys);
PRIMITIVE_REGISTRY.bind('qlang/prim/vals', vals);
PRIMITIVE_REGISTRY.bind('qlang/prim/has',  has);

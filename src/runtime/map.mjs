// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.
//
// Meta lives in manifest.qlang.

import { nullaryOp, valueOp } from './dispatch.mjs';
import { isQMap, isQSet, isKeyword, describeType } from '../types.mjs';
import { declareSubjectError, declareModifierError } from '../operand-errors.mjs';

const KeysSubjectNotMap    = declareSubjectError('KeysSubjectNotMap',    'keys',  'Map');
const ValsSubjectNotMap    = declareSubjectError('ValsSubjectNotMap',    'vals',  'Map');
const HasSubjectNotMapOrSet = declareSubjectError('HasSubjectNotMapOrSet', 'has',   'Map or Set');
const HasKeyNotKeyword     = declareModifierError('HasKeyNotKeyword',    'has',   2, 'keyword (Map subject)');

export const keys = nullaryOp('keys', (map) => {
  if (!isQMap(map)) throw new KeysSubjectNotMap(describeType(map), map);
  const result = new Set();
  for (const k of map.keys()) result.add(k);
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  if (!isQMap(map)) throw new ValsSubjectNotMap(describeType(map), map);
  return [...map.values()];
});

export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    if (!isKeyword(key)) throw new HasKeyNotKeyword(describeType(key), key);
    return subject.has(key);
  }
  if (isQSet(subject)) return subject.has(key);
  throw new HasSubjectNotMapOrSet(describeType(subject), subject);
});

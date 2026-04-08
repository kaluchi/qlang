// Map operands. `has` is polymorphic across Map and Set subjects
// and therefore owns three distinct error classes — one for each
// branch of the type check.

import { nullaryOp, valueOp } from './dispatch.mjs';
import { isQMap, isQSet, isKeyword, describeType } from '../types.mjs';
import { declareSubjectError, declareModifierError } from './operand-errors.mjs';

const KeysSubjectNotMap    = declareSubjectError('KeysSubjectNotMap',    'keys',  'Map');
const ValsSubjectNotMap    = declareSubjectError('ValsSubjectNotMap',    'vals',  'Map');
const HasSubjectNotMapOrSet = declareSubjectError('HasSubjectNotMapOrSet', 'has',   'Map or Set');
const HasKeyNotKeyword     = declareModifierError('HasKeyNotKeyword',    'has',   2, 'keyword (Map subject)');

export const keys = nullaryOp('keys', (map) => {
  if (!isQMap(map)) throw new KeysSubjectNotMap(describeType(map), map);
  const result = new Set();
  for (const k of map.keys()) result.add(k);
  return result;
}, {
  category: 'map-op',
  subject: 'Map',
  modifiers: [],
  returns: 'Set of keywords',
  docs: ['Returns the Set of keys (keywords) in the Map.'],
  examples: ['{:name "Alice" :age 30} | keys → #{:name :age}'],
  throws: ['KeysSubjectNotMap']
});

export const vals = nullaryOp('vals', (map) => {
  if (!isQMap(map)) throw new ValsSubjectNotMap(describeType(map), map);
  return [...map.values()];
}, {
  category: 'map-op',
  subject: 'Map',
  modifiers: [],
  returns: 'Vec',
  docs: ['Returns a Vec of values, in insertion order.'],
  examples: ['{:name "Alice" :age 30} | vals → ["Alice" 30]'],
  throws: ['ValsSubjectNotMap']
});

export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    if (!isKeyword(key)) throw new HasKeyNotKeyword(describeType(key), key);
    return subject.has(key);
  }
  if (isQSet(subject)) return subject.has(key);
  throw new HasSubjectNotMapOrSet(describeType(subject), subject);
}, {
  category: 'map-op',
  subject: 'Map or Set',
  modifiers: ['keyword (Map) or any (Set)'],
  returns: 'boolean',
  docs: ['Returns true if the Map contains the keyword key, or if the Set contains the value. Polymorphic on subject.'],
  examples: ['{:name "Alice"} | has(:name) → true', '#{:a :b :c} | has(:b) → true'],
  throws: ['HasSubjectNotMapOrSet', 'HasKeyNotKeyword']
});

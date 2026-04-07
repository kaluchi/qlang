// Map operands.

import { nullaryOp, valueOp } from './dispatch.mjs';
import { TypeError as QTypeError } from '../errors.mjs';
import { isQMap, isKeyword, describeType } from '../types.mjs';

function ensureMap(name, value) {
  if (!isQMap(value)) {
    throw new QTypeError(`${name} requires Map subject, got ${describeType(value)}`);
  }
}

export const keys = nullaryOp('keys', (map) => {
  ensureMap('keys', map);
  const result = new Set();
  for (const k of map.keys()) result.add(k);
  return result;
});

export const vals = nullaryOp('vals', (map) => {
  ensureMap('vals', map);
  return [...map.values()];
});

// has — polymorphic across Map and Set subject. The Map form
// expects a keyword key; the Set form accepts any value.
export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    if (!isKeyword(key)) {
      throw new QTypeError(`has(:key) requires a keyword, got ${describeType(key)}`);
    }
    return subject.has(key);
  }
  if (subject instanceof Set) {
    return subject.has(key);
  }
  throw new QTypeError(`has requires Map or Set subject, got ${describeType(subject)}`);
});

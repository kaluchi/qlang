// Map operands.
//
// `has` is polymorphic across Map and Set subjects. The Map form
// requires a keyword key; the Set form accepts any value as the
// member to test. The polymorphic dispatch lives here because
// `has` is most naturally documented alongside Map operands.

import { nullaryOp, valueOp } from './dispatch.mjs';
import { ensureMap } from './guards.mjs';
import { isQMap, isQSet, isKeyword, describeType } from '../types.mjs';
import { QlangTypeError } from '../errors.mjs';

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

export const has = valueOp('has', 2, (subject, key) => {
  if (isQMap(subject)) {
    if (!isKeyword(key)) {
      throw new QlangTypeError(
        `has requires a keyword key for Map subjects, got ${describeType(key)}`
      );
    }
    return subject.has(key);
  }
  if (isQSet(subject)) {
    return subject.has(key);
  }
  throw new QlangTypeError(
    `has requires Map or Set subject, got ${describeType(subject)}`
  );
});

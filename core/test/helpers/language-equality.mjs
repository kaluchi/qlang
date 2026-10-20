// The tests compare a value of the language by the tie of the one order, which
// reads the tag a vector or a map holds on itself, and leave any other value
// to the equality of vitest [QSWRK#tooling].

import { expect } from 'vitest';
import { compareValues } from '../../src/ordering.mjs';
import { TAG_HEADER_SYMBOL, VALUE_CLASS_TAG } from '../../src/types.mjs';

const isOfTheLanguage = value => value === null || ['boolean', 'number', 'string'].includes(typeof value)
  || Array.isArray(value) || value instanceof Map || (typeof value === 'object' && value[VALUE_CLASS_TAG] !== undefined);
const isMarked = value => typeof value === 'object' && value !== null && (value[TAG_HEADER_SYMBOL] !== undefined || value[VALUE_CLASS_TAG] !== undefined);

expect.addEqualityTesters([
  function inTheOneOrder(left, right) {
    if ((!isMarked(left) && !isMarked(right)) || !isOfTheLanguage(left) || !isOfTheLanguage(right)) return undefined;
    return compareValues(left, right) === 0;
  }
]);

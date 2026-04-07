// Type-guard helpers shared across runtime operands.
//
// Each guard throws a uniform QlangTypeError on mismatch and is a
// no-op on success. Centralizing the messages here keeps the
// runtime modules small and the error wording consistent.

import { QlangTypeError } from '../errors.mjs';
import {
  isVec,
  isQMap,
  describeType
} from '../types.mjs';

export function ensureVec(opName, value) {
  if (!isVec(value)) {
    throw new QlangTypeError(
      `${opName} requires Vec subject, got ${describeType(value)}`
    );
  }
}

export function ensureMap(opName, value) {
  if (!isQMap(value)) {
    throw new QlangTypeError(
      `${opName} requires Map subject, got ${describeType(value)}`
    );
  }
}

export function ensureNumber(opName, position, value) {
  if (typeof value !== 'number') {
    throw new QlangTypeError(
      `${opName} requires number at position ${position}, got ${describeType(value)}`
    );
  }
}

export function ensureString(opName, position, value) {
  if (typeof value !== 'string') {
    throw new QlangTypeError(
      `${opName} requires string at position ${position}, got ${describeType(value)}`
    );
  }
}

// ensureSameOrderingType — guard for ordering operands
// (gt/lt/gte/lte/min/max/sort). Both values must be comparable
// scalars (number or string) of the same type. Rejects nil,
// booleans, keywords, collections, and functions.
export function ensureSameOrderingType(opName, a, b) {
  assertComparable(opName, 1, a);
  assertComparable(opName, 2, b);
  if (typeof a !== typeof b) {
    throw new QlangTypeError(
      `${opName} cannot compare ${describeType(a)} with ${describeType(b)}`
    );
  }
}

function assertComparable(opName, position, value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new QlangTypeError(
      `${opName} requires comparable scalar (number or string) at position ${position}, got ${describeType(value)}`
    );
  }
}

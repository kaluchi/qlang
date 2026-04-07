// Type-guard helpers shared across runtime operands.
//
// Each guard is a no-op on success and throws a specific error
// subclass on mismatch. The subclass carries structured diagnostic
// context (operand name, position, expected/actual type) so error
// handling and tests can pattern-match precisely.

import {
  SubjectTypeError,
  ModifierTypeError,
  ComparabilityError,
  ElementTypeError
} from '../errors.mjs';
import {
  isVec,
  isQMap,
  isQSet,
  describeType
} from '../types.mjs';

// ── Subject guards ─────────────────────────────────────────────
// The subject is the value the operand primarily operates on
// (position 1 in the subject-first convention).

export function ensureVec(operand, value) {
  if (!isVec(value)) {
    throw new SubjectTypeError(operand, 'Vec', describeType(value), value);
  }
}

export function ensureMap(operand, value) {
  if (!isQMap(value)) {
    throw new SubjectTypeError(operand, 'Map', describeType(value), value);
  }
}

export function ensureSet(operand, value) {
  if (!isQSet(value)) {
    throw new SubjectTypeError(operand, 'Set', describeType(value), value);
  }
}

// ── Modifier guards ────────────────────────────────────────────
// Modifiers are captured args at position ≥ 2. Each guard records
// the exact position so a failure message can point the user to
// the wrong argument.

export function ensureNumber(operand, position, value) {
  if (typeof value !== 'number') {
    throw new ModifierTypeError(operand, position, 'number', describeType(value));
  }
}

export function ensureString(operand, position, value) {
  if (typeof value !== 'string') {
    throw new ModifierTypeError(operand, position, 'string', describeType(value));
  }
}

// ── Element guards ─────────────────────────────────────────────
// Used when an operand walks the elements of a collection and
// requires each one to satisfy a type constraint. Indexes are
// reported so the user can locate the offending element.

export function ensureNumberElement(operand, index, value) {
  if (typeof value !== 'number') {
    throw new ElementTypeError(operand, index, 'number', describeType(value));
  }
}

// ── Ordering guards ────────────────────────────────────────────
// Guards for gt/lt/gte/lte/min/max/sort — values must be
// comparable scalars (number or string) and share the same type.

export function ensureSameOrderingType(operand, left, right) {
  assertComparable(operand, 1, left);
  assertComparable(operand, 2, right);
  if (typeof left !== typeof right) {
    throw new ComparabilityError(operand, describeType(left), describeType(right));
  }
}

function assertComparable(operand, position, value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ModifierTypeError(
      operand,
      position,
      'comparable scalar (number or string)',
      describeType(value)
    );
  }
}

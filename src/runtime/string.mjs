// String concatenation operands. Subject-first: subject is the
// string at position 1, modifier is the string at position 2.

import { valueOp } from './dispatch.mjs';
import { TypeError as QTypeError } from '../errors.mjs';
import { describeType } from '../types.mjs';

function ensureString(name, position, value) {
  if (typeof value !== 'string') {
    throw new QTypeError(
      `${name} requires string at position ${position}, got ${describeType(value)}`
    );
  }
}

export const prepend = valueOp('prepend', 2, (subject, prefix) => {
  ensureString('prepend', 1, subject);
  ensureString('prepend', 2, prefix);
  return prefix + subject;
});

export const append = valueOp('append', 2, (subject, suffix) => {
  ensureString('append', 1, subject);
  ensureString('append', 2, suffix);
  return subject + suffix;
});

// String concatenation operands. Subject-first: position 1 is the
// subject string, position 2 is the modifier string.

import { valueOp } from './dispatch.mjs';
import { ensureString } from './guards.mjs';

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

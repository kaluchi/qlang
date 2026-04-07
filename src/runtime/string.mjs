// String concatenation operands. Subject-first: position 1 is the
// subject string, position 2 is the modifier string. Every check
// throws a class unique to its call site.

import { valueOp } from './dispatch.mjs';
import { describeType } from '../types.mjs';
import { declareModifierError } from './operand-errors.mjs';

const PrependSubjectNotString = declareModifierError('PrependSubjectNotString', 'prepend', 1, 'string');
const PrependPrefixNotString  = declareModifierError('PrependPrefixNotString',  'prepend', 2, 'string');
const AppendSubjectNotString  = declareModifierError('AppendSubjectNotString',  'append',  1, 'string');
const AppendSuffixNotString   = declareModifierError('AppendSuffixNotString',   'append',  2, 'string');

export const prepend = valueOp('prepend', 2, (subject, prefix) => {
  if (typeof subject !== 'string') throw new PrependSubjectNotString(describeType(subject), subject);
  if (typeof prefix  !== 'string') throw new PrependPrefixNotString(describeType(prefix), prefix);
  return prefix + subject;
});

export const append = valueOp('append', 2, (subject, suffix) => {
  if (typeof subject !== 'string') throw new AppendSubjectNotString(describeType(subject), subject);
  if (typeof suffix  !== 'string') throw new AppendSuffixNotString(describeType(suffix), suffix);
  return subject + suffix;
});

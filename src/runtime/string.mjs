// String operands. Subject-first: position 1 is the subject string,
// position 2 is the modifier string. Every check throws a class
// unique to its call site.

import { valueOp } from './dispatch.mjs';
import { describeType, isVec } from '../types.mjs';
import {
  declareModifierError,
  declareSubjectError,
  declareElementError
} from './operand-errors.mjs';

const PrependSubjectNotString = declareModifierError('PrependSubjectNotString', 'prepend', 1, 'string');
const PrependPrefixNotString  = declareModifierError('PrependPrefixNotString',  'prepend', 2, 'string');
const AppendSubjectNotString  = declareModifierError('AppendSubjectNotString',  'append',  1, 'string');
const AppendSuffixNotString   = declareModifierError('AppendSuffixNotString',   'append',  2, 'string');
const SplitSubjectNotString   = declareModifierError('SplitSubjectNotString',   'split',   1, 'string');
const SplitSeparatorNotString = declareModifierError('SplitSeparatorNotString', 'split',   2, 'string');
const JoinSubjectNotVec       = declareSubjectError('JoinSubjectNotVec',        'join',    'Vec of strings');
const JoinElementNotString    = declareElementError('JoinElementNotString',     'join',    'string');
const JoinSeparatorNotString  = declareModifierError('JoinSeparatorNotString',  'join',    2, 'string');

export const prepend = valueOp('prepend', 2, (subject, prefix) => {
  if (typeof subject !== 'string') throw new PrependSubjectNotString(describeType(subject), subject);
  if (typeof prefix  !== 'string') throw new PrependPrefixNotString(describeType(prefix), prefix);
  return prefix + subject;
}, {
  category: 'string',
  subject: 'string',
  modifiers: ['string'],
  returns: 'string',
  docs: ['Concatenates the modifier in front of the subject.'],
  examples: ['"world" | prepend("hello ") → "hello world"'],
  throws: ['PrependSubjectNotString', 'PrependPrefixNotString']
});

export const append = valueOp('append', 2, (subject, suffix) => {
  if (typeof subject !== 'string') throw new AppendSubjectNotString(describeType(subject), subject);
  if (typeof suffix  !== 'string') throw new AppendSuffixNotString(describeType(suffix), suffix);
  return subject + suffix;
}, {
  category: 'string',
  subject: 'string',
  modifiers: ['string'],
  returns: 'string',
  docs: ['Concatenates the subject with the modifier on the right.'],
  examples: ['"hello" | append(" world") → "hello world"'],
  throws: ['AppendSubjectNotString', 'AppendSuffixNotString']
});

export const split = valueOp('split', 2, (subject, separator) => {
  if (typeof subject !== 'string') throw new SplitSubjectNotString(describeType(subject), subject);
  if (typeof separator !== 'string') throw new SplitSeparatorNotString(describeType(separator), separator);
  return subject.split(separator);
}, {
  category: 'string',
  subject: 'string',
  modifiers: ['string'],
  returns: 'Vec of strings',
  docs: ['Splits the subject on every occurrence of the separator. Returns a Vec of substrings. Inverse of join.'],
  examples: ['"a,b,c" | split(",") → ["a" "b" "c"]', '"line1\\nline2" | split("\\n") → ["line1" "line2"]'],
  throws: ['SplitSubjectNotString', 'SplitSeparatorNotString']
});

export const join = valueOp('join', 2, (subject, separator) => {
  if (!isVec(subject)) throw new JoinSubjectNotVec(describeType(subject), subject);
  if (typeof separator !== 'string') throw new JoinSeparatorNotString(describeType(separator), separator);
  for (let i = 0; i < subject.length; i++) {
    if (typeof subject[i] !== 'string') {
      throw new JoinElementNotString(i, describeType(subject[i]), subject[i]);
    }
  }
  return subject.join(separator);
}, {
  category: 'string',
  subject: 'Vec of strings',
  modifiers: ['string'],
  returns: 'string',
  docs: ['Joins the elements of a Vec of strings with the separator between consecutive elements. Inverse of split.'],
  examples: ['["a" "b" "c"] | join(",") → "a,b,c"', '[] | join(",") → ""'],
  throws: ['JoinSubjectNotVec', 'JoinElementNotString', 'JoinSeparatorNotString']
});

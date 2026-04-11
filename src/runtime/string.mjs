// String operands. Subject-first: position 1 is the subject string,
// position 2 is the modifier string. Every check throws a class
// unique to its call site.
//
// Meta lives in lib/qlang/core.qlang.

import { valueOp } from './dispatch.mjs';
import { describeType, isVec, keyword } from '../types.mjs';
import {
  declareModifierError,
  declareSubjectError,
  declareElementError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const PrependSubjectNotString = declareModifierError('PrependSubjectNotString', 'prepend', 1, 'string');
const PrependPrefixNotString  = declareModifierError('PrependPrefixNotString',  'prepend', 2, 'string');
const AppendSubjectNotString  = declareModifierError('AppendSubjectNotString',  'append',  1, 'string');
const AppendSuffixNotString   = declareModifierError('AppendSuffixNotString',   'append',  2, 'string');
const SplitSubjectNotString   = declareModifierError('SplitSubjectNotString',   'split',   1, 'string');
const SplitSeparatorNotString = declareModifierError('SplitSeparatorNotString', 'split',   2, 'string');
const JoinSubjectNotVec       = declareSubjectError('JoinSubjectNotVec',        'join',    'Vec of strings');
const JoinElementNotString    = declareElementError('JoinElementNotString',     'join',    'string');
const JoinSeparatorNotString  = declareModifierError('JoinSeparatorNotString',  'join',    2, 'string');
const ContainsSubjectNotString    = declareModifierError('ContainsSubjectNotString',    'contains',    1, 'string');
const ContainsNeedleNotString     = declareModifierError('ContainsNeedleNotString',     'contains',    2, 'string');
const StartsWithSubjectNotString  = declareModifierError('StartsWithSubjectNotString',  'startsWith',  1, 'string');
const StartsWithPrefixNotString   = declareModifierError('StartsWithPrefixNotString',   'startsWith',  2, 'string');
const EndsWithSubjectNotString    = declareModifierError('EndsWithSubjectNotString',    'endsWith',    1, 'string');
const EndsWithSuffixNotString     = declareModifierError('EndsWithSuffixNotString',     'endsWith',    2, 'string');

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

export const split = valueOp('split', 2, (subject, separator) => {
  if (typeof subject !== 'string') throw new SplitSubjectNotString(describeType(subject), subject);
  if (typeof separator !== 'string') throw new SplitSeparatorNotString(describeType(separator), separator);
  return subject.split(separator);
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
});

export const contains = valueOp('contains', 2, (subject, needle) => {
  if (typeof subject !== 'string') throw new ContainsSubjectNotString(describeType(subject), subject);
  if (typeof needle  !== 'string') throw new ContainsNeedleNotString(describeType(needle), needle);
  return subject.includes(needle);
});

export const startsWith = valueOp('startsWith', 2, (subject, prefix) => {
  if (typeof subject !== 'string') throw new StartsWithSubjectNotString(describeType(subject), subject);
  if (typeof prefix  !== 'string') throw new StartsWithPrefixNotString(describeType(prefix), prefix);
  return subject.startsWith(prefix);
});

export const endsWith = valueOp('endsWith', 2, (subject, suffix) => {
  if (typeof subject !== 'string') throw new EndsWithSubjectNotString(describeType(subject), subject);
  if (typeof suffix  !== 'string') throw new EndsWithSuffixNotString(describeType(suffix), suffix);
  return subject.endsWith(suffix);
});

// Variant-B primitive registry bindings — coexist with IMPLS.
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/prepend'),    prepend);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/append'),     append);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/split'),      split);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/join'),       join);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/contains'),   contains);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/startsWith'), startsWith);
PRIMITIVE_REGISTRY.bind(keyword('qlang/prim/endsWith'),   endsWith);

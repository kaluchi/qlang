// String operands. Subject-first: position 1 is the subject string,
// position 2 is the modifier string. Every check throws a class
// unique to its call site.
//
// Meta lives in lib/qlang/core.qlang.

import { valueOp } from './dispatch.mjs';
import { isVecShape } from '../types.mjs';
import {
  declareModifierError,
  declareSubjectError,
  declareElementError
} from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const PrependSubjectNotStringError    = declareModifierError('PrependSubjectNotStringError',    'prepend',    1, 'string');
const PrependPrefixNotStringError     = declareModifierError('PrependPrefixNotStringError',     'prepend',    2, 'string');
const AppendSubjectNotStringError     = declareModifierError('AppendSubjectNotStringError',     'append',     1, 'string');
const AppendSuffixNotStringError      = declareModifierError('AppendSuffixNotStringError',      'append',     2, 'string');
const SplitSubjectNotStringError      = declareModifierError('SplitSubjectNotStringError',      'split',      1, 'string');
const SplitSeparatorNotStringError    = declareModifierError('SplitSeparatorNotStringError',    'split',      2, 'string');
const JoinSubjectNotVecError          = declareSubjectError('JoinSubjectNotVecError',           'join',       'vec');
const JoinElementNotStringError       = declareElementError('JoinElementNotStringError',        'join',       'string');
const JoinSeparatorNotStringError     = declareModifierError('JoinSeparatorNotStringError',     'join',       2, 'string');
const ContainsSubjectNotStringError   = declareModifierError('ContainsSubjectNotStringError',   'contains',   1, 'string');
const ContainsNeedleNotStringError    = declareModifierError('ContainsNeedleNotStringError',    'contains',   2, 'string');
const StartsWithSubjectNotStringError = declareModifierError('StartsWithSubjectNotStringError', 'startsWith', 1, 'string');
const StartsWithPrefixNotStringError  = declareModifierError('StartsWithPrefixNotStringError',  'startsWith', 2, 'string');
const EndsWithSubjectNotStringError   = declareModifierError('EndsWithSubjectNotStringError',   'endsWith',   1, 'string');
const EndsWithSuffixNotStringError    = declareModifierError('EndsWithSuffixNotStringError',    'endsWith',   2, 'string');

export const prepend = valueOp('prepend', 2, (subject, prefix) => {
  if (typeof subject !== 'string') throw new PrependSubjectNotStringError(subject);
  if (typeof prefix  !== 'string') throw new PrependPrefixNotStringError(prefix);
  return prefix + subject;
});

export const append = valueOp('append', 2, (subject, suffix) => {
  if (typeof subject !== 'string') throw new AppendSubjectNotStringError(subject);
  if (typeof suffix  !== 'string') throw new AppendSuffixNotStringError(suffix);
  return subject + suffix;
});

export const split = valueOp('split', 2, (subject, separator) => {
  if (typeof subject !== 'string') throw new SplitSubjectNotStringError(subject);
  if (typeof separator !== 'string') throw new SplitSeparatorNotStringError(separator);
  return subject.split(separator);
});

export const join = valueOp('join', 2, (subject, separator) => {
  if (!isVecShape(subject)) throw new JoinSubjectNotVecError(subject);
  if (typeof separator !== 'string') throw new JoinSeparatorNotStringError(separator);
  for (let i = 0; i < subject.length; i++) {
    if (typeof subject[i] !== 'string') {
      throw new JoinElementNotStringError(i, subject[i]);
    }
  }
  return subject.join(separator);
});

export const contains = valueOp('contains', 2, (subject, needle) => {
  if (typeof subject !== 'string') throw new ContainsSubjectNotStringError(subject);
  if (typeof needle  !== 'string') throw new ContainsNeedleNotStringError(needle);
  return subject.includes(needle);
});

export const startsWith = valueOp('startsWith', 2, (subject, prefix) => {
  if (typeof subject !== 'string') throw new StartsWithSubjectNotStringError(subject);
  if (typeof prefix  !== 'string') throw new StartsWithPrefixNotStringError(prefix);
  return subject.startsWith(prefix);
});

export const endsWith = valueOp('endsWith', 2, (subject, suffix) => {
  if (typeof subject !== 'string') throw new EndsWithSubjectNotStringError(subject);
  if (typeof suffix  !== 'string') throw new EndsWithSuffixNotStringError(suffix);
  return subject.endsWith(suffix);
});

// Bind into PRIMITIVE_REGISTRY under :qlang/prim/<name> at module-load time.
PRIMITIVE_REGISTRY.bind('qlang/prim/prepend',    prepend);
PRIMITIVE_REGISTRY.bind('qlang/prim/append',     append);
PRIMITIVE_REGISTRY.bind('qlang/prim/split',      split);
PRIMITIVE_REGISTRY.bind('qlang/prim/join',       join);
PRIMITIVE_REGISTRY.bind('qlang/prim/contains',   contains);
PRIMITIVE_REGISTRY.bind('qlang/prim/startsWith', startsWith);
PRIMITIVE_REGISTRY.bind('qlang/prim/endsWith',   endsWith);

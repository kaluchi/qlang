// The verbs of strings, and `join`, `prepend` and `append` of vectors,
// each a plain function over the values the head of its verb checked
// [D72]: `prepend` and `append` reside on `::string`, whose prefix and
// suffix are strings, and on `::vec`, whose element is any value.
//
// The verbs live in lib/qlang/string.qlang and vec.qlang.

import { isVec } from '../types.mjs';
import {
  declareModifierError,
  declareSubjectError,
  declareElementError
} from '../operand-errors.mjs';
import { bindPrim } from '../primitives.mjs';

// The refusals the heads raise at the places they declare; the prefix
// and the suffix are the string's alone, a vector taking any element
// [D73].
declareModifierError('PrependPrefixNotStringError',     '::string/prepend', 2, 'string');
declareModifierError('AppendSuffixNotStringError',      '::string/append',  2, 'string');
declareModifierError('SplitSubjectNotStringError',      'split',      1, 'string');
declareModifierError('SplitSeparatorNotStringError',    'split',      2, 'string');
declareSubjectError('LinesSubjectNotStringError',       'lines',      'string');
declareSubjectError('JoinSubjectNotVecError',           'join',       'vec');
declareModifierError('JoinSeparatorNotStringError',     'join',       2, 'string');
declareModifierError('ContainsSubjectNotStringError',   'contains',   1, 'string');
declareModifierError('ContainsNeedleNotStringError',    'contains',   2, 'string');
declareModifierError('StartsWithSubjectNotStringError', 'startsWith', 1, 'string');
declareModifierError('StartsWithPrefixNotStringError',  'startsWith', 2, 'string');
declareModifierError('EndsWithSubjectNotStringError',   'endsWith',   1, 'string');
declareModifierError('EndsWithSuffixNotStringError',    'endsWith',   2, 'string');
const JoinElementNotStringError = declareElementError('JoinElementNotStringError', 'join', 'string');

// A string takes its prefix or its suffix, a vector its element at the
// head or at the end, so `[1] | append [2 3]` answers `[1 [2 3]]`.
bindPrim('prepend', (subject, prefix) => (isVec(subject) ? [prefix, ...subject] : prefix + subject));
bindPrim('append',  (subject, suffix) => (isVec(subject) ? [...subject, suffix] : subject + suffix));

bindPrim('split', (subject, separator) => subject.split(separator));

// The lines of a text [D49]: a `\n` ends a line and a `\r` before it
// belongs to the ending; the text after the last ending is a line
// unless it is empty, so a final newline closes the last line rather
// than opening one, and the empty text has no lines.
bindPrim('lines', subject => {
  const pieces = subject.split(/\r?\n/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces;
});

bindPrim('join', (subject, separator) => {
  const stranger = subject.findIndex(element => typeof element !== 'string');
  if (stranger >= 0) throw new JoinElementNotStringError(stranger, subject[stranger]);
  return subject.join(separator);
});

bindPrim('contains',   (subject, needle) => subject.includes(needle));
bindPrim('startsWith', (subject, prefix) => subject.startsWith(prefix));
bindPrim('endsWith',   (subject, suffix) => subject.endsWith(suffix));

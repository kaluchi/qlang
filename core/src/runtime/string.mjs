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
declareModifierError('string/PrependPrefixNotStringError',     '::string/prepend', 2, 'string');
declareModifierError('string/AppendSuffixNotStringError',      '::string/append',  2, 'string');
declareModifierError('string/SplitSubjectNotStringError',      'split',      1, 'string');
declareModifierError('string/SplitSeparatorNotStringError',    'split',      2, 'string');
declareSubjectError('string/LinesSubjectNotStringError',       'lines',      'string');
declareSubjectError('string/LowerSubjectNotStringError',       'lower',      'string');
declareSubjectError('string/UpperSubjectNotStringError',       'upper',      'string');
declareSubjectError('string/TrimSubjectNotStringError',        'trim',       'string');
declareSubjectError('vec/JoinSubjectNotVecError',           'join',       'vec');
declareModifierError('vec/JoinSeparatorNotStringError',     'join',       2, 'string');
declareModifierError('string/ContainsSubjectNotStringError',   'contains',   1, 'string');
declareModifierError('string/ContainsNeedleNotStringError',    'contains',   2, 'string');
declareModifierError('string/StartsWithSubjectNotStringError', 'startsWith', 1, 'string');
declareModifierError('string/StartsWithPrefixNotStringError',  'startsWith', 2, 'string');
declareModifierError('string/EndsWithSubjectNotStringError',   'endsWith',   1, 'string');
declareModifierError('string/EndsWithSuffixNotStringError',    'endsWith',   2, 'string');
const VecJoinElementNotStringError = declareElementError('vec/JoinElementNotStringError', 'join', 'string');

// A string takes its prefix or its suffix, a vector its element at the
// head or at the end, so `[1] | append [2 3]` answers `[1 [2 3]]`.
bindPrim(['string/prepend', 'vec/prepend'], (subject, prefix) => (isVec(subject) ? [prefix, ...subject] : prefix + subject));
bindPrim(['string/append', 'vec/append'],  (subject, suffix) => (isVec(subject) ? [...subject, suffix] : subject + suffix));

bindPrim('string/split', (subject, separator) => subject.split(separator));

// The lines of a text [D49]: a `\n` ends a line and a `\r` before it
// belongs to the ending; the text after the last ending is a line
// unless it is empty, so a final newline closes the last line rather
// than opening one, and the empty text has no lines.
bindPrim('string/lines', subject => {
  const pieces = subject.split(/\r?\n/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces;
});

bindPrim('vec/join', (subject, separator) => {
  const stranger = subject.findIndex(element => typeof element !== 'string');
  if (stranger >= 0) throw new VecJoinElementNotStringError(stranger, subject[stranger]);
  return subject.join(separator);
});

// The case of a text, folded letter by letter as Unicode maps it, so
// two texts that differ in case alone compare equal once folded [D107].
bindPrim('string/lower', subject => subject.toLowerCase());
bindPrim('string/upper', subject => subject.toUpperCase());

// The text without the whitespace at its two ends, a line break among it
// [D141].
bindPrim('string/trim', subject => subject.trim());

bindPrim('string/contains',   (subject, needle) => subject.includes(needle));
bindPrim('string/startsWith', (subject, prefix) => subject.startsWith(prefix));
bindPrim('string/endsWith',   (subject, suffix) => subject.endsWith(suffix));

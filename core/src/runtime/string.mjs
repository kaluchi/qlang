// The names of strings, and `join`, `prepend` and `append` of vectors,
// each a plain function over the subject and the parts of its args
// [D167]: `prepend` and `append` reside on `::string`, whose prefix and
// suffix are strings, and on `::vec`, whose element is any value.
//
// The verbs live in lib/qlang/string.qlang and vec.qlang.

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';

// An element `join` writes is a string.
const VecJoinElementNotStringError = declareRefusal('vec/join/ElementNotStringError');

// A string takes its prefix or its suffix, a vector its element at the
// head or at the end, so `[1] | append [2 3]` answers `[1 [2 3]]`.
bindPrim('string/prepend', (text, prefix) => prefix + text);
bindPrim('vec/prepend', (vector, element) => [element, ...vector]);
bindPrim('string/append', (text, suffix) => text + suffix);
bindPrim('vec/append', (vector, element) => [...vector, element]);

// The empty separator cuts the text into its characters, the code points
// `count` counts, so no character falls in halves.
bindPrim('string/split', (subject, separator) => (separator === '' ? Array.from(subject) : subject.split(separator)));

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
  if (stranger >= 0) throw new VecJoinElementNotStringError({ index: stranger, actualValue: subject[stranger] });
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

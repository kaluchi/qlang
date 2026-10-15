// The primitives of strings, and `join`, `prepend` and `append` of
// vectors, whose words the catalog declares under `::string` and `::vec`
// [QSQUO#modifier].

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { isKeyword, isRegex } from '../types.mjs';
import { containsMatch, piecesBetweenMatches } from './regex.mjs';

// A value a word writes into text: a string as it is and a keyword as
// its name, as the JSON channel writes it [QSPRN#json], [QSTXT#string].
const writtenAsText = value => (isKeyword(value) ? value.name : value);

// An element `join` writes is a string or a keyword.
const VecJoinElementNotStringOrKeywordError = declareRefusal('vec/join/ElementNotStringOrKeywordError');

bindPrim('string/prepend', (text, prefix) => writtenAsText(prefix) + text);
bindPrim('vec/prepend', (vector, element) => [element, ...vector]);
bindPrim('string/append', (text, suffix) => text + writtenAsText(suffix));
bindPrim('vec/append', (vector, element) => [...vector, element]);

// The empty separator cuts the text into its characters, the code points
// `count` counts, so no character falls in halves, and a pattern cuts it at
// every match [QSTXT#pattern].
bindPrim('string/split', (subject, separator) => {
  if (isRegex(separator)) return piecesBetweenMatches(subject, separator);
  return separator === '' ? Array.from(subject) : subject.split(separator);
});

// A `\n` ends a line, a `\r` before it belongs to the ending, and a
// final ending opens no line [QSTXT#string].
bindPrim('string/lines', subject => {
  const pieces = subject.split(/\r?\n/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces;
});

bindPrim('vec/join', (subject, separator) => {
  const stranger = subject.findIndex(element => typeof element !== 'string' && !isKeyword(element));
  if (stranger >= 0) throw new VecJoinElementNotStringOrKeywordError({ index: stranger, actualValue: subject[stranger] });
  return subject.map(writtenAsText).join(writtenAsText(separator));
});

// The case of a text, folded as Unicode maps the text, a letter to two where it
// writes two and a final sigma by its place [QSTXT#string].
bindPrim('string/lower', subject => subject.toLowerCase());
bindPrim('string/upper', subject => subject.toUpperCase());

// The text without the whitespace at its two ends, a line break among it
// [QSTXT#string].
bindPrim('string/trim', subject => subject.trim());

bindPrim('string/contains',   (subject, needle) => (isRegex(needle) ? containsMatch(subject, needle) : subject.includes(needle)));
bindPrim('string/startsWith', (subject, prefix) => subject.startsWith(prefix));
bindPrim('string/endsWith',   (subject, suffix) => subject.endsWith(suffix));

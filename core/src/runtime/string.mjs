// The primitives of strings, whose verbs the catalog declares under
// `::string` [QSTXT#string].

import { registerPrimitive, combines } from '../primitives.mjs';
import { isKeyword, isRegex } from '../types.mjs';
import { containsMatch, piecesBetweenMatches } from './regex.mjs';

// A value a verb writes into text: a string as it is and a keyword as
// its name, as `json` writes it [QSTXT#string].
export const writtenAsText = value => (isKeyword(value) ? value.name : value);

// The text each joins to its subject shares its tags [D388].
registerPrimitive('string/prepend', combines((text, prefix) => writtenAsText(prefix) + text));
registerPrimitive('string/append', combines((text, suffix) => text + writtenAsText(suffix)));

// The empty separator cuts the text into its characters, the code points
// `count` counts, so no character falls in halves, and a regex cuts it at
// every match [QSTXT#split].
registerPrimitive('string/split', (subject, separator) => {
  if (isRegex(separator)) return piecesBetweenMatches(subject, separator);
  return separator === '' ? Array.from(subject) : subject.split(separator);
});

// A `\n` ends a line, a `\r` before it belongs to the ending, and a
// final ending opens no line [QSTXT#string].
registerPrimitive('string/lines', subject => {
  const pieces = subject.split(/\r?\n/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces;
});

// The case of a text, folded as Unicode maps the text, a letter to two where it
// writes two and a final sigma by its place [QSTXT#string].
registerPrimitive('string/lower', subject => subject.toLowerCase());
registerPrimitive('string/upper', subject => subject.toUpperCase());

// The text without the whitespace at its two ends, a line break among it
// [QSTXT#string].
registerPrimitive('string/trim', subject => subject.trim());

registerPrimitive('string/contains',   (subject, needle) => (isRegex(needle) ? containsMatch(subject, needle) : subject.includes(needle)));
registerPrimitive('string/startsWith', (subject, prefix) => subject.startsWith(prefix));
registerPrimitive('string/endsWith',   (subject, suffix) => subject.endsWith(suffix));

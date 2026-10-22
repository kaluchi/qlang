// [QSTXT#string]

import { registerPrimitive, combines } from '../primitives.mjs';
import { isKeyword, isRegex } from '../types.mjs';
import { containsMatch, piecesBetweenMatches } from './regex.mjs';

export const writtenAsText = value => (isKeyword(value) ? value.name : value);

registerPrimitive('string/prepend', combines((text, prefix) => writtenAsText(prefix) + text));
registerPrimitive('string/append', combines((text, suffix) => text + writtenAsText(suffix)));

// [QSTXT#split]
registerPrimitive('string/split', (subject, separator) => {
  if (isRegex(separator)) return piecesBetweenMatches(subject, separator);
  return separator === '' ? Array.from(subject) : subject.split(separator);
});

// [QSTXT#string]
registerPrimitive('string/lines', subject => {
  const pieces = subject.split(/\r?\n/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces;
});

registerPrimitive('string/lower', subject => subject.toLowerCase());
registerPrimitive('string/upper', subject => subject.toUpperCase());

registerPrimitive('string/trim', subject => subject.trim());

registerPrimitive('string/contains',   (subject, needle) => (isRegex(needle) ? containsMatch(subject, needle) : subject.includes(needle)));
registerPrimitive('string/startsWith', (subject, prefix) => subject.startsWith(prefix));
registerPrimitive('string/endsWith',   (subject, suffix) => subject.endsWith(suffix));

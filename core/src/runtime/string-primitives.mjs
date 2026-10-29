// [QSTXT#string]

import { registerPrimitive, asCombiner } from '../primitives.mjs';
import { isKeyword, isRegex } from '../types.mjs';
import { containsMatch, piecesBetweenMatches } from './regex-primitives.mjs';

export const writtenAsText = value => (isKeyword(value) ? value.name : value);

registerPrimitive('string/prepend', asCombiner((text, prefix) => writtenAsText(prefix) + text));
registerPrimitive('string/append', asCombiner((text, suffix) => text + writtenAsText(suffix)));

// [QSTXT#search]
const isHighSurrogate = unit => unit >= 0xD800 && unit <= 0xDBFF;
const isLowSurrogate = unit => unit >= 0xDC00 && unit <= 0xDFFF;
const insideACodePoint = (text, at) => at > 0 && at < text.length && isHighSurrogate(text.charCodeAt(at - 1)) && isLowSurrogate(text.charCodeAt(at));
const cutsACodePoint = needle => needle.length > 0 && (isLowSurrogate(needle.charCodeAt(0)) || isHighSurrogate(needle.charCodeAt(needle.length - 1)));

function wholeMatchesOf(text, needle) {
  const starts = [];
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    if (insideACodePoint(text, at) || insideACodePoint(text, at + needle.length)) continue;
    starts.push(at);
    at += needle.length - 1;
  }
  return starts;
}

function piecesBetween(text, separator) {
  if (!cutsACodePoint(separator)) return text.split(separator);
  const pieces = [];
  let from = 0;
  for (const at of wholeMatchesOf(text, separator)) {
    pieces.push(text.slice(from, at));
    from = at + separator.length;
  }
  pieces.push(text.slice(from));
  return pieces;
}

const containsText = (text, needle) => (cutsACodePoint(needle) ? wholeMatchesOf(text, needle).length > 0 : text.includes(needle));

// [QSTXT#split]
registerPrimitive('string/split', (subject, separator) => {
  if (isRegex(separator)) return piecesBetweenMatches(subject, separator);
  return separator === '' ? Array.from(subject) : piecesBetween(subject, separator);
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

// [QSTXT#search]
registerPrimitive('string/contains',   (subject, needle) => (isRegex(needle) ? containsMatch(subject, needle) : containsText(subject, needle)));
registerPrimitive('string/startsWith', (subject, prefix) => subject.startsWith(prefix) && !insideACodePoint(subject, prefix.length));
registerPrimitive('string/endsWith',   (subject, suffix) => subject.endsWith(suffix) && !insideACodePoint(subject, subject.length - suffix.length));

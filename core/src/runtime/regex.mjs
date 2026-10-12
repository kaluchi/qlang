// The words of a string that read its text by a pattern: whether a match
// stands, the first match and its groups, the groups it names, the text of
// every match, the text put in the place of every match, and the pieces
// between the matches.
// The decisions it exists for: [D246].

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { isRegex, isErrorValue } from '../types.mjs';
import { engineOf } from '../pattern.mjs';

const engineFor = (regex, extra = '') => engineOf(regex.source, regex.flags, extra);

// The engine of a pattern that matches the empty text at once, which
// answers the groups the pattern holds, every one of them unmatched.
const groupsOf = regex => engineOf(`${regex.source}|`, regex.flags).exec('');

// The vector of a match: its text, then each group in its place, a group
// that took no part null.
const matchVector = found => Object.freeze(Array.from(found, part => part ?? null));

export const containsMatch = (text, regex) => engineFor(regex).test(text);

// The pieces of a text between the matches of a pattern, as the pieces of
// a text between its separators: what the groups of the pattern capture
// stays out of them.
export function piecesBetweenMatches(text, regex) {
  const stride = groupsOf(regex).length;
  return Object.freeze(text.split(engineFor(regex)).filter((_piece, index) => index % stride === 0));
}

bindPrim('string/match', (text, regex) => {
  const found = engineFor(regex).exec(text);
  return found === null ? null : matchVector(found);
});

const StringCapturePatternNamesNoGroupError = declareRefusal('string/capture/PatternNamesNoGroupError');

bindPrim('string/capture', (text, regex) => {
  const names = Object.keys(groupsOf(regex).groups ?? {});
  if (names.length === 0) throw new StringCapturePatternNamesNoGroupError({ actualValue: regex });
  const found = engineFor(regex).exec(text);
  return found === null ? null : new Map(names.map(name => [name, found.groups[name] ?? null]));
});

bindPrim('string/scan', (text, regex) => Object.freeze(Array.from(text.matchAll(engineFor(regex, 'g')), found => found[0])));

// A text looked for as a pattern of itself, every character the engine
// reads as syntax escaped.
const SYNTAX_CHARACTERS = /[\\^$.*+?()[\]{}|/]/g;
const engineOfText = needle => engineOf(needle.replace(SYNTAX_CHARACTERS, '\\$&'), '', 'g');

const StringReplaceWithAnswerNotStringError = declareRefusal('string/replace/with/AnswerNotStringError');

// The text with every match of the code's own: the code runs on the vector
// `match` answers for each, and its answer is a string or the error it
// raised.
async function replacedByCode(text, engine, code) {
  let replaced = '';
  let from = 0;
  for (const found of text.matchAll(engine)) {
    const answer = await code(matchVector(found));
    if (isErrorValue(answer)) return answer;
    if (typeof answer !== 'string') throw new StringReplaceWithAnswerNotStringError({ actualValue: answer });
    replaced += text.slice(from, found.index) + answer;
    from = found.index + found[0].length;
  }
  return replaced + text.slice(from);
}

// A pattern's replacement names the parts of a match, `$1`, `$<name>`,
// `$&`; a text's stands as written.
bindPrim('string/replace', (text, pattern, replacement) => {
  if (typeof replacement === 'function') return replacedByCode(text, isRegex(pattern) ? engineFor(pattern, 'g') : engineOfText(pattern), replacement);
  return isRegex(pattern) ? text.replace(engineFor(pattern, 'g'), replacement) : text.replaceAll(pattern, () => replacement);
});

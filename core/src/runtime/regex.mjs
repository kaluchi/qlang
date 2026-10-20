// The verbs of a string that read its text by a regex: whether a match
// stands, the first match and its groups, the groups it names, the text of
// every match, the text put in the place of every match, and the pieces
// between the matches.
// The rules it holds: [QSTXT#match].

import { registerPrimitive, runs } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { isRegex, isErrorValue, beneathTags } from '../types.mjs';
import { engineOf } from '../regex-read.mjs';

const engineFor = (regex, extra = '') => engineOf(regex.source, regex.flags, extra);

// The engine of a regex that matches the empty text at once, which
// answers the groups the regex holds, every one of them unmatched.
const groupsOf = regex => engineOf(`${regex.source}|`, regex.flags).exec('');

// The vector of a match: its text, then each group at the index of its
// number, a group that took no part null.
const matchVector = found => Object.freeze(Array.from(found, part => part ?? null));

export const containsMatch = (text, regex) => engineFor(regex).test(text);

// The pieces of a text between the matches of a regex, as the pieces of
// a text between its separators: what the groups of the regex capture
// stays out of them.
export function piecesBetweenMatches(text, regex) {
  const stride = groupsOf(regex).length;
  return Object.freeze(text.split(engineFor(regex)).filter((_piece, index) => index % stride === 0));
}

registerPrimitive('string/match', (text, regex) => {
  const found = engineFor(regex).exec(text);
  return found === null ? null : matchVector(found);
});

const StringCaptureRegexNamesNoGroupError = declareRefusal('string/capture/RegexNamesNoGroupError');

registerPrimitive('string/capture', (text, regex) => {
  const names = Object.keys(groupsOf(regex).groups ?? {});
  if (names.length === 0) throw new StringCaptureRegexNamesNoGroupError({ actualValue: regex });
  const found = engineFor(regex).exec(text);
  return found === null ? null : new Map(names.map(name => [name, found.groups[name] ?? null]));
});

registerPrimitive('string/scan', (text, regex) => Object.freeze(Array.from(text.matchAll(engineFor(regex, 'g')), found => found[0])));

// A text looked for as a regex of itself, every character the engine
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
    if (typeof beneathTags(answer) !== 'string') throw new StringReplaceWithAnswerNotStringError({ actualValue: answer });
    replaced += text.slice(from, found.index) + beneathTags(answer);
    from = found.index + found[0].length;
  }
  return replaced + text.slice(from);
}

// A regex's replacement names the parts of a match, `$1`, `$<name>`,
// `$&`, a `$<name>` of a group the regex lacks standing as written; a
// text's stands as written. A text is looked for by code points as a
// regex is, so the empty text cuts no character in halves [QSTXT#match].
registerPrimitive('string/replace', runs(['with'], (text, needle, replacement) => {
  const engine = isRegex(needle) ? engineFor(needle, 'g') : engineOfText(needle);
  if (typeof replacement === 'function') return replacedByCode(text, engine, replacement);
  return text.replace(engine, isRegex(needle) ? withGroupsOf(needle, replacement) : () => replacement);
}));

// The replacement with each `$<name>` of a group the regex lacks escaped,
// so it stands as written.
function withGroupsOf(regex, replacement) {
  const groups = new Set(Object.keys(groupsOf(regex).groups ?? {}));
  return replacement.replace(/\$\$|\$<([^>]*)>/g, (token, name) => (token === '$$' || groups.has(name) ? token : `$${token}`));
}

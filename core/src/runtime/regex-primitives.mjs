// [QSTXT#match]

import { registerPrimitive, runsAsCode } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { isRegex, isKeyword, isErrorValue, beneathTags } from '../types.mjs';
import { engineOf } from '../regex-read.mjs';

const engineFor = (regex, extra = '') => engineOf(regex.source, regex.flags, extra);

const groupsOf = regex => engineOf(`${regex.source}|`, regex.flags).exec('');

const matchVector = found => Object.freeze(Array.from(found, part => part ?? null));

export const containsMatch = (text, regex) => engineFor(regex).test(text);

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
  if (names.length === 0) throw new StringCaptureRegexNamesNoGroupError({});
  const found = engineFor(regex).exec(text);
  return found === null ? null : new Map(names.map(name => [name, found.groups[name] ?? null]));
});

registerPrimitive('string/scan', (text, regex) => Object.freeze(Array.from(text.matchAll(engineFor(regex, 'g')), found => found[0])));

const SYNTAX_CHARACTERS = /[\\^$.*+?()[\]{}|/]/g;
const engineOfText = needle => engineOf(needle.replace(SYNTAX_CHARACTERS, '\\$&'), '', 'g');

const StringReplaceWithAnswerKindNotTakenError = declareRefusal('string/replace/WithAnswerKindNotTakenError');

async function replacedByCode(text, engine, code) {
  let replaced = '';
  let from = 0;
  for (const found of text.matchAll(engine)) {
    const answer = await code(matchVector(found));
    if (isErrorValue(answer)) return answer;
    if (typeof beneathTags(answer) !== 'string') throw new StringReplaceWithAnswerKindNotTakenError({ 'with/expected': kindsExpected('string'), 'with/answer': answer });
    replaced += text.slice(from, found.index) + beneathTags(answer);
    from = found.index + found[0].length;
  }
  return replaced + text.slice(from);
}

registerPrimitive('string/replace', runsAsCode(['with'], (text, needle, written) => {
  const replacement = isKeyword(written) ? written.name : written;
  const engine = isRegex(needle) ? engineFor(needle, 'g') : engineOfText(needle);
  if (typeof replacement === 'function') return replacedByCode(text, engine, replacement);
  return text.replace(engine, isRegex(needle) ? withGroupsOf(needle, replacement) : () => replacement);
}));

function withGroupsOf(regex, replacement) {
  const groups = new Set(Object.keys(groupsOf(regex).groups ?? {}));
  return replacement.replace(/\$\$|\$<([^>]*)>/g, (token, name) => (token === '$$' || groups.has(name) ? token : `$${token}`));
}

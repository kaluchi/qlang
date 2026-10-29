// [QSCND#convert]

import { makeKeyword, makeTag, makeRegex, isKeyword, isTag, isVec, isRegex, tagOf, beneathTags } from '../types.mjs';
import { makeSet, kindsExpected } from '../ordering.mjs';
import { canonicalFlags, regexProblem, textRefusal } from '../regex-read.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { declareRefusal, refusingAPart } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { splitAddress } from '../address.mjs';
import { parseSource } from '../parse.mjs';
import { partOf } from '../parsed-parts.mjs';

const textOf = value => (isKeyword(value) || isTag(value) ? value.name : String(value));
registerPrimitive(['string/toString', 'number/toString', 'keyword/toString', 'tag/toString', 'boolean/toString'], textOf);

const TO_KEYWORD_ADDRESSES = ['keyword/toKeyword', 'string/toKeyword', 'number/toKeyword', 'boolean/toKeyword', 'null/toKeyword', 'tag/toKeyword'];
export const KINDS_A_KEY_FILES_UNDER = kindsExpected(...TO_KEYWORD_ADDRESSES.map(address => splitAddress(address)[0]));

export function keywordFiledFor(value) {
  if (!KINDS_A_KEY_FILES_UNDER.some(kind => kind.name === tagOf(value).name)) return null;
  return isKeyword(value) ? value : makeKeyword(textOf(value));
}

registerPrimitive(TO_KEYWORD_ADDRESSES, keywordFiledFor);

function literalWritten(text, isOfKind) {
  let quote;
  try {
    quote = parseSource(text);
  } catch {
    return null;
  }
  if (!isOfKind(quote[0])) return null;
  const { start, end } = partOf(quote).parts[0].span;
  return start.offset === 0 && end.offset === text.length ? quote[0] : null;
}

export const numberWritten = text => literalWritten(text, step => typeof step === 'number');

const StringToNumberTextNotNumberError = declareRefusal('string/toNumber/TextNotNumberError');
const KeywordToNumberNameNotNumberError = declareRefusal('keyword/toNumber/NameNotNumberError');

registerPrimitive('number/toNumber', number => number);
registerPrimitive('string/toNumber', text => {
  const number = numberWritten(text);
  if (number === null) throw new StringToNumberTextNotNumberError({});
  return number;
});
registerPrimitive('keyword/toNumber', key => {
  const number = numberWritten(key.name);
  if (number === null) throw new KeywordToNumberNameNotNumberError({});
  return number;
});

const StringToTagTextNotTagError = declareRefusal('string/toTag/TextNotTagError');
const KeywordToTagNameNotTagError = declareRefusal('keyword/toTag/NameNotTagError');

registerPrimitive('tag/toTag', tag => tag);
registerPrimitive('string/toTag', text => {
  if (!readsAsBareKeyword(text)) throw new StringToTagTextNotTagError({});
  return makeTag(text);
});
registerPrimitive('keyword/toTag', key => {
  if (!readsAsBareKeyword(key.name)) throw new KeywordToTagNameNotTagError({});
  return makeTag(key.name);
});

// [QSTXT#match]
const StringToRegexTextNotRegexError = declareRefusal('string/toRegex/TextNotRegexError');
const StringToRegexLiteralNotSourceError = declareRefusal('string/toRegex/LiteralNotSourceError');
const StringToRegexFlagsNotFlagsError = declareRefusal('string/toRegex/FlagsNotFlagsError');

const RegexToRegexFlagsNotFlagsError = declareRefusal('regex/toRegex/FlagsNotFlagsError');
registerPrimitive('regex/toRegex', (regex, written) => {
  if (written === null) return regex;
  const flags = canonicalFlags(written);
  if (flags === null) throw new RegexToRegexFlagsNotFlagsError({});
  return makeRegex(regex.source, flags);
});
registerPrimitive('string/toRegex', (text, written) => {
  const flags = canonicalFlags(written ?? '');
  if (flags === null) throw new StringToRegexFlagsNotFlagsError({});
  if (literalWritten(text, isRegex) !== null) throw new StringToRegexLiteralNotSourceError({});
  const problem = regexProblem(text, flags);
  if (problem !== null) throw new StringToRegexTextNotRegexError({ message: textRefusal(problem) });
  return makeRegex(text, flags);
});

registerPrimitive(['vec/toVec', 'set/toVec', 'quote/toVec', 'doc/toVec'], sequence => Object.freeze([...sequence]));
registerPrimitive('set/toSet', set => set);
registerPrimitive('vec/toSet', vector => makeSet(vector));
// [QSCND#convert]
const VecToMapElementNotPairError = declareRefusal('vec/toMap/ElementNotPairError');
const VecToMapKeyKindNotTakenError = declareRefusal('vec/toMap/KeyKindNotTakenError');

function mapOfPairs(pairs) {
  const built = new Map();
  pairs.forEach((element, index) => {
    const pair = beneathTags(element);
    if (!isVec(pair) || pair.length !== 2) throw refusingAPart(new VecToMapElementNotPairError({}), index);
    const key = keywordFiledFor(beneathTags(pair[0]));
    if (key === null) throw refusingAPart(new VecToMapKeyKindNotTakenError({ 'subject/expected': KINDS_A_KEY_FILES_UNDER }), index, 0);
    built.set(key.name, pair[1]);
  });
  return built;
}

registerPrimitive('map/toMap', map => map);
registerPrimitive('vec/toMap', mapOfPairs);

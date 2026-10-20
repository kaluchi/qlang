// The verbs that turn a value into another kind, each a verb of the
// source kind named for the kind it answers, `toNumber`, taking the subject
// the walk served alone: a kind answers its own verb as
// itself, and what a verb cannot read whole it refuses under its address
// [QSCND#convert].

import { keyword, makeTag, makeRegex, isKeyword, isTag, isVec, isRegex, typeOf, beneathTags } from '../types.mjs';
import { makeSet, kindsExpected } from '../ordering.mjs';
import { canonicalFlags, regexProblem, textRefusal } from '../regex-read.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { declareRefusal, refusingTheSubject } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { splitAddress } from '../address.mjs';
import { parse } from '../parse.mjs';
import { partOf } from '../walk.mjs';

const textOf = value => (isKeyword(value) || isTag(value) ? value.name : String(value));
registerPrimitive(['string/toString', 'number/toString', 'keyword/toString', 'tag/toString', 'boolean/toString'], textOf);

// The kinds a key files under are those `toKeyword` lives on, the set a
// refusal of a key of another kind holds as `:expected` [QSCND#convert].
const TO_KEYWORD_ADDRESSES = ['keyword/toKeyword', 'string/toKeyword', 'number/toKeyword', 'boolean/toKeyword', 'null/toKeyword', 'tag/toKeyword'];
export const KINDS_A_KEY_FILES_UNDER = kindsExpected(...TO_KEYWORD_ADDRESSES.map(address => splitAddress(address)[0]));

// keywordFiledFor(value) → the keyword a value of a kind a key files under
// is named by, a keyword itself, a string or a number by its text, a
// boolean or null by its literal and a tag name by its name, as `toKeyword`
// names it and `groupBy`, `indexBy` and `toMap` file it [QSCND#convert]; null for a
// value of another kind.
export function keywordFiledFor(value) {
  if (!KINDS_A_KEY_FILES_UNDER.some(kind => kind.name === typeOf(value).name)) return null;
  return isKeyword(value) ? value : keyword(textOf(value));
}

registerPrimitive(TO_KEYWORD_ADDRESSES, keywordFiledFor);

// The literal of the kind a text writes whole, its one step spanning it, or null.
function literalWritten(text, isOfKind) {
  let quote;
  try {
    quote = parse(text);
  } catch {
    return null;
  }
  if (!isOfKind(quote[0])) return null;
  const { start, end } = partOf(quote).parts[0].span;
  return start.offset === 0 && end.offset === text.length ? quote[0] : null;
}

// The number a text writes whole as the literal of a number, or null.
const numberWritten = text => literalWritten(text, step => typeof step === 'number');

const StringToNumberTextNotNumberError = declareRefusal('string/toNumber/TextNotNumberError');
const KeywordToNumberNameNotNumberError = declareRefusal('keyword/toNumber/NameNotNumberError');

registerPrimitive('number/toNumber', number => number);
registerPrimitive('string/toNumber', text => {
  const number = numberWritten(text);
  if (number === null) throw refusingTheSubject(new StringToNumberTextNotNumberError());
  return number;
});
registerPrimitive('keyword/toNumber', key => {
  const number = numberWritten(key.name);
  if (number === null) throw refusingTheSubject(new KeywordToNumberNameNotNumberError());
  return number;
});

const StringToTagTextNotTagError = declareRefusal('string/toTag/TextNotTagError');
const KeywordToTagNameNotTagError = declareRefusal('keyword/toTag/NameNotTagError');

registerPrimitive('tag/toTag', tag => tag);
registerPrimitive('string/toTag', text => {
  if (!readsAsBareKeyword(text)) throw refusingTheSubject(new StringToTagTextNotTagError());
  return makeTag(text);
});
registerPrimitive('keyword/toTag', key => {
  if (!readsAsBareKeyword(key.name)) throw refusingTheSubject(new KeywordToTagNameNotTagError());
  return makeTag(key.name);
});

// A string reads as the source of a regex with the flags the call gives,
// none for null, and a text that writes the literal of a regex whole is
// refused [QSTXT#match].
const StringToRegexTextNotRegexError = declareRefusal('string/toRegex/TextNotRegexError');
const StringToRegexLiteralNotSourceError = declareRefusal('string/toRegex/LiteralNotSourceError');
const StringToRegexFlagsNotFlagsError = declareRefusal('string/toRegex/flags/NotFlagsError');

const RegexToRegexFlagsNotFlagsError = declareRefusal('regex/toRegex/flags/NotFlagsError');
registerPrimitive('regex/toRegex', (regex, written) => {
  if (written === null) return regex;
  const flags = canonicalFlags(written);
  if (flags === null) throw new RegexToRegexFlagsNotFlagsError({ actualValue: written });
  return makeRegex(regex.source, flags);
});
registerPrimitive('string/toRegex', (text, written) => {
  const flags = canonicalFlags(written ?? '');
  if (flags === null) throw new StringToRegexFlagsNotFlagsError({ actualValue: written });
  if (literalWritten(text, isRegex) !== null) throw refusingTheSubject(new StringToRegexLiteralNotSourceError());
  const problem = regexProblem(text, flags);
  if (problem !== null) throw refusingTheSubject(new StringToRegexTextNotRegexError({ message: textRefusal(problem) }));
  return makeRegex(text, flags);
});

registerPrimitive(['vec/toVec', 'set/toVec'], sequence => Object.freeze([...sequence]));
registerPrimitive('set/toSet', set => set);
registerPrimitive('vec/toSet', vector => makeSet(vector));
// The map a vector's pairs `[key value]` write, the reverse of `entries`:
// each key named as `toKeyword` names it, and of two pairs with one key
// the last holds [QSCND#convert].
const VecToMapElementNotPairError = declareRefusal('vec/toMap/ElementNotPairError');
const VecToMapKeyKindNotTakenError = declareRefusal('vec/toMap/KeyKindNotTakenError');

function mapOfPairs(pairs) {
  const built = new Map();
  pairs.forEach((element, index) => {
    const pair = beneathTags(element);
    if (!isVec(pair) || pair.length !== 2) throw new VecToMapElementNotPairError({ index, actualValue: element });
    const key = keywordFiledFor(beneathTags(pair[0]));
    if (key === null) throw new VecToMapKeyKindNotTakenError({ index, expected: KINDS_A_KEY_FILES_UNDER, actualValue: pair[0] });
    built.set(key.name, pair[1]);
  });
  return built;
}

registerPrimitive('map/toMap', map => map);
registerPrimitive('vec/toMap', mapOfPairs);

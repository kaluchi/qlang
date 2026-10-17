// The verbs that turn a value into another kind, each a verb of the
// source kind named for the kind it answers, `toNumber`, a plain function
// over the subject the walk served: a kind answers its own verb as
// itself, and what a verb cannot read whole it refuses under its address
// [QSCND#convert].

import { keyword, makeTag, makeSet, makeRegex, isKeyword, isTag, isVec, kindsExpected, typeOf } from '../types.mjs';
import { canonicalFlags, patternProblem, textRefusal } from '../pattern.mjs';
import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { splitAddress } from '../address.mjs';
import { parse } from '../parse.mjs';

const textOf = value => (isKeyword(value) || isTag(value) ? value.name : String(value));
bindPrim(['string/toString', 'number/toString', 'keyword/toString', 'tag/toString', 'boolean/toString'], textOf);

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

bindPrim(TO_KEYWORD_ADDRESSES, keywordFiledFor);

// The node of a literal of the kind a text writes whole, or null.
function literalWritten(text, nodeType) {
  let ast;
  try {
    ast = parse(text);
  } catch {
    return null;
  }
  return ast.type === nodeType && ast.text === text ? ast : null;
}

// The number a text writes whole as the literal of a number, or null.
const numberWritten = text => literalWritten(text, 'NumberLit')?.value ?? null;

const StringToNumberTextNotNumberError = declareRefusal('string/toNumber/TextNotNumberError');
const KeywordToNumberNameNotNumberError = declareRefusal('keyword/toNumber/NameNotNumberError');

bindPrim('number/toNumber', number => number);
bindPrim('string/toNumber', text => {
  const number = numberWritten(text);
  if (number === null) throw new StringToNumberTextNotNumberError({ actualValue: text });
  return number;
});
bindPrim('keyword/toNumber', key => {
  const number = numberWritten(key.name);
  if (number === null) throw new KeywordToNumberNameNotNumberError({ actualValue: key });
  return number;
});

const StringToTagTextNotNameError = declareRefusal('string/toTag/TextNotNameError');
const KeywordToTagNameNotNameError = declareRefusal('keyword/toTag/NameNotNameError');

bindPrim('tag/toTag', tag => tag);
bindPrim('string/toTag', text => {
  if (!readsAsBareKeyword(text)) throw new StringToTagTextNotNameError({ actualValue: text });
  return makeTag(text);
});
bindPrim('keyword/toTag', key => {
  if (!readsAsBareKeyword(key.name)) throw new KeywordToTagNameNotNameError({ actualValue: key });
  return makeTag(key.name);
});

// A string reads as the source of a pattern with the flags the call gives,
// none for null, and a text that writes the literal of a pattern whole is
// refused [QSTXT#pattern].
const StringToRegexTextNotPatternError = declareRefusal('string/toRegex/TextNotPatternError');
const StringToRegexLiteralNotSourceError = declareRefusal('string/toRegex/LiteralNotSourceError');
const StringToRegexFlagsNotFlagsError = declareRefusal('string/toRegex/flags/NotFlagsError');

const RegexToRegexFlagsNotFlagsError = declareRefusal('regex/toRegex/flags/NotFlagsError');
bindPrim('regex/toRegex', (regex, written) => {
  if (written === null) return regex;
  const flags = canonicalFlags(written);
  if (flags === null) throw new RegexToRegexFlagsNotFlagsError({ actualValue: written });
  return makeRegex(regex.source, flags);
});
bindPrim('string/toRegex', (text, written) => {
  const flags = canonicalFlags(written ?? '');
  if (flags === null) throw new StringToRegexFlagsNotFlagsError({ actualValue: written });
  if (literalWritten(text, 'RegexLit') !== null) throw new StringToRegexLiteralNotSourceError({ actualValue: text });
  const problem = patternProblem(text, flags);
  if (problem !== null) throw new StringToRegexTextNotPatternError({ message: textRefusal(problem), actualValue: text });
  return makeRegex(text, flags);
});

bindPrim(['vec/toVec', 'set/toVec'], sequence => Object.freeze([...sequence]));
bindPrim('set/toSet', set => set);
bindPrim('vec/toSet', vector => makeSet(vector));
// The map a vector's pairs `[key value]` write, the reverse of `entries`:
// each key named as `toKeyword` names it, and of two pairs with one key
// the last holds [QSCND#convert].
const VecToMapElementNotPairError = declareRefusal('vec/toMap/ElementNotPairError');
const VecToMapKeyKindNotTakenError = declareRefusal('vec/toMap/KeyKindNotTakenError');

function mapOfPairs(pairs) {
  const built = new Map();
  pairs.forEach((pair, index) => {
    if (!isVec(pair) || pair.length !== 2) throw new VecToMapElementNotPairError({ index, actualValue: pair });
    const key = keywordFiledFor(pair[0]);
    if (key === null) throw new VecToMapKeyKindNotTakenError({ index, expected: KINDS_A_KEY_FILES_UNDER, actualValue: pair[0] });
    built.set(key.name, pair[1]);
  });
  return built;
}

bindPrim('map/toMap', map => map);
bindPrim('vec/toMap', mapOfPairs);

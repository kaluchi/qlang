// The words that turn a value into another kind, each a word of the
// source kind named for the kind it answers, `toNumber`, a plain function
// over the subject the walk served: a kind answers its own word as
// itself, and what a word cannot read whole it refuses under its address
// [D244].

import { keyword, makeTag, makeSet, makeRegex, isString, isNumber, isBoolean, isKeyword, isTag, NULL } from '../types.mjs';
import { patternProblem } from '../pattern.mjs';
import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { readsAsBareKeyword } from '../name-chars.mjs';
import { parse } from '../parse.mjs';
import { mapConstructor } from './tagged.mjs';

// keywordFiledFor(value) → the keyword a value files under as a key, or
// null for a value no key names: a keyword itself, a string or a number
// by its text, a boolean or null by its literal and a tag name by its
// name, as `groupBy` and `indexBy` file a key [D201].
export function keywordFiledFor(value) {
  if (isKeyword(value)) return value;
  if (isString(value) || isNumber(value) || isBoolean(value) || value === NULL) return keyword(String(value));
  if (isTag(value)) return keyword(value.name);
  return null;
}

const textOf = value => (isKeyword(value) || isTag(value) ? value.name : String(value));
bindPrim(['string/toString', 'number/toString', 'keyword/toString', 'tag/toString', 'boolean/toString'], textOf);

bindPrim(['keyword/toKeyword', 'string/toKeyword', 'number/toKeyword', 'boolean/toKeyword', 'null/toKeyword', 'tag/toKeyword'], keywordFiledFor);

// The number a text writes whole as the literal of a number, or null.
function numberWritten(text) {
  let ast;
  try {
    ast = parse(text);
  } catch {
    return null;
  }
  return ast.type === 'NumberLit' && ast.text === text ? ast.value : null;
}

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

// A string reads as the source of a pattern, its flags none [D246].
const StringToRegexTextNotPatternError = declareRefusal('string/toRegex/TextNotPatternError');

bindPrim('regex/toRegex', regex => regex);
bindPrim('string/toRegex', text => {
  const problem = patternProblem(text, '');
  if (problem !== null) throw new StringToRegexTextNotPatternError({ message: problem, actualValue: text });
  return makeRegex(text, '');
});

bindPrim(['vec/toVec', 'set/toVec'], sequence => Object.freeze([...sequence]));
bindPrim('set/toSet', set => set);
bindPrim('vec/toSet', vector => makeSet(vector));
bindPrim(['map/toMap', 'vec/toMap'], mapConstructor);

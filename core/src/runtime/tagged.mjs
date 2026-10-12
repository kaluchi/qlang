// The constructors of the kinds, each `(payload, state) → value` under
// the address of the kind's `construct`, `number/construct` [D169], and
// the verbs that lay a tag over a value and take it off.

import { mintUnderTag } from './verb.mjs';
import { bindPrim, bindStateReader } from '../primitives.mjs';
import {
  isVec, isKeyword, isRegex, isQMap, isNull, isBoolean, isNumber, isString, isDocSegment, makeDoc,
  isTag, makeSet, makeTag, makeTaggedInstance, TAG_HEADER_SYMBOL, BUILTIN_TAG, stampTagHeader
} from '../types.mjs';
import { declareRefusal } from '../errors.mjs';

// `::set[…]` — the set of a vector's elements, the one `distinct`
// mints [D16], so `::set[3 1 3]`, `#[3 1 3]` and `[3 1 3] | distinct`
// are one value.
const SetPayloadNotVecError = declareRefusal('set/PayloadNotVecError');

function setConstructor(payload) {
  if (!isVec(payload)) throw new SetPayloadNotVecError({ actualValue: payload });
  return makeSet(payload);
}

bindPrim('set/construct', setConstructor);

// The constructors of the core's kinds [D32], [D168]: each reads its
// payload as the value of its kind, so `::vec[1 2]` and `[1 2]` are one
// value and print as the latter, and a payload of
// another kind is refused at the site. A vector or a map under a tag of
// its own reads as the bare one.
const NullPayloadNotNullError       = declareRefusal('null/PayloadNotNullError');
const BooleanPayloadNotBooleanError = declareRefusal('boolean/PayloadNotBooleanError');
const NumberPayloadNotNumberError   = declareRefusal('number/PayloadNotNumberError');
const StringPayloadNotStringError   = declareRefusal('string/PayloadNotStringError');
const KeywordPayloadNotKeywordError = declareRefusal('keyword/PayloadNotKeywordError');
const RegexPayloadNotRegexError = declareRefusal('regex/PayloadNotRegexError');
const TagPayloadNotTagError         = declareRefusal('tag/PayloadNotTagError');
const VecPayloadNotVecError         = declareRefusal('vec/PayloadNotVecError');
const MapPayloadNotMapError         = declareRefusal('map/PayloadNotMapError');

function coreKindConstructor(isOfKind, ErrorCls, bareValueOf = payload => payload) {
  return payload => {
    if (!isOfKind(payload)) throw new ErrorCls({ actualValue: payload });
    return bareValueOf(payload);
  };
}

const bareVecOf = vec => vec[TAG_HEADER_SYMBOL] === undefined ? vec : Object.freeze([...vec]);
const bareMapOf = map => map[TAG_HEADER_SYMBOL] === undefined ? map : new Map(map);

bindPrim('null/construct',    coreKindConstructor(isNull, NullPayloadNotNullError));
bindPrim('boolean/construct', coreKindConstructor(isBoolean, BooleanPayloadNotBooleanError));
// A number is a finite double: an answer brought under `::number` that
// left the doubles' range is refused here, once for every word [D169].
const NumberNotFiniteError = declareRefusal('number/NotFiniteError');
const finiteNumber = coreKindConstructor(isNumber, NumberPayloadNotNumberError);
bindPrim('number/construct', payload => {
  const number = finiteNumber(payload);
  if (!Number.isFinite(number)) throw new NumberNotFiniteError({});
  return number;
});
bindPrim('string/construct',  coreKindConstructor(isString, StringPayloadNotStringError));
bindPrim('keyword/construct', coreKindConstructor(isKeyword, KeywordPayloadNotKeywordError));
bindPrim('regex/construct',   coreKindConstructor(isRegex, RegexPayloadNotRegexError));
bindPrim('tag/construct',     coreKindConstructor(isTag, TagPayloadNotTagError));
bindPrim('vec/construct',     coreKindConstructor(isVec, VecPayloadNotVecError, bareVecOf));
// `::map[…]` also builds a map from the vector of its pairs `[key
// value]`, the reverse of `entries`, as a doc comes back from its
// segments: a key is a keyword, or a string or a number naming the
// keyword of its text, as the key of `groupBy` [D130], and of two pairs
// with one key the last wins [D138].
const MapElementNotPairError = declareRefusal('map/ElementNotPairError');
const MapKeyNotKeywordError  = declareRefusal('map/KeyNotKeywordError');

function keyNameOfPair(pairKey, index) {
  if (isKeyword(pairKey)) return pairKey.name;
  if (isString(pairKey) || isNumber(pairKey)) return String(pairKey);
  throw new MapKeyNotKeywordError({ index, actualValue: pairKey });
}

export function mapConstructor(payload) {
  if (isQMap(payload)) return bareMapOf(payload);
  if (!isVec(payload)) throw new MapPayloadNotMapError({ actualValue: payload });
  const built = new Map();
  payload.forEach((pair, index) => {
    if (!isVec(pair) || pair.length !== 2) throw new MapElementNotPairError({ index, actualValue: pair });
    built.set(keyNameOfPair(pair[0], index), pair[1]);
  });
  return built;
}

bindPrim('map/construct', mapConstructor);

// `::desc(…)` — any value turned to descend, its place in the one order
// the reverse of its payload's [D140].
const DESC_TAG = makeTag('desc');
bindPrim('desc/construct', payload => makeTaggedInstance(DESC_TAG, payload));

// `::doc[…]` — the doc of a vector of prose strings and quotes [D19], so
// a doc comes apart into its segments and back by `tag`.
const DocPayloadNotVecError     = declareRefusal('doc/PayloadNotVecError');
const DocElementNotSegmentError = declareRefusal('doc/ElementNotSegmentError');

function docConstructor(payload) {
  if (!isVec(payload)) throw new DocPayloadNotVecError({ actualValue: payload });
  payload.forEach((element, index) => {
    if (!isDocSegment(element)) throw new DocElementNotSegmentError({ index, actualValue: element });
  });
  return makeDoc(payload);
}

bindPrim('doc/construct', docConstructor);

// `::builtin{…}` — the descriptor, the value of a name under a label
// that a primitive answers, the `construct` of a kind among them [D164],
// [D169]; its fields stay flat under its tag.
const BuiltinPayloadNotMapError = declareRefusal('builtin/PayloadNotMapError');

function builtinConstructor(payload) {
  if (!isQMap(payload)) throw new BuiltinPayloadNotMapError({ actualValue: payload });
  const descriptor = new Map();
  for (const [k, v] of payload) descriptor.set(k, v);
  stampTagHeader(descriptor, BUILTIN_TAG);
  return descriptor;
}

bindPrim('builtin/construct', builtinConstructor);

const AnyTagPairTagNotTagError = declareRefusal('any/tag/PairTagNotTagError');
const AnyTagSubjectNotPairError = declareRefusal('any/tag/SubjectNotPairError');

// The value beneath a tag: a copy of the vector or the map without the
// tag, a set's vector among them, or the value a wrapper holds.
function payloadOf(tagged) {
  if (Array.isArray(tagged)) return Object.freeze([...tagged]);
  if (tagged instanceof Map) return new Map(tagged);
  return tagged.payload;
}

// `payload` and `within` reside on `::tagged`, each a plain function
// over the tagged value the walk served [D34]; the page of `within` keeps
// its subject's kind, so the answer of its edit mints back under the
// subject's tag [D41], [D167].
bindPrim('tagged/payload', subject => payloadOf(subject));
bindPrim('tagged/within', async (subject, code) => await code(payloadOf(subject)));

// `tag` resides on `::any` and reads the state of its call, whose
// scope holds the constructor of the tag [D79]: `value | tag ::Foo` lays
// the tag over the subject, and `[::Foo value] | tag` over the second
// element of the pair it takes apart.
async function mintPair(pair, state) {
  if (!isVec(pair) || pair.length !== 2) {
    throw new AnyTagSubjectNotPairError({
      actualValue: pair
    });
  }
  const [pairTag, value] = pair;
  if (!isTag(pairTag)) throw new AnyTagPairTagNotTagError({ actualValue: pairTag });
  return await mintUnderTag(state, pairTag, value);
}

bindStateReader('any/tag', async (subject, tagName, state) =>
  (isNull(tagName) ? await mintPair(subject, state) : await mintUnderTag(state, tagName, subject)));



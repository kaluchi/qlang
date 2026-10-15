// The constructors of the kinds, each `(payload, state) → value` under
// the address of the kind's `construct`, `number/construct` [QSBLD#kind], and
// the verbs that lay a tag over a value and take it off.

import { mintUnderTag } from './verb.mjs';
import { bindPrim, bindStateReader, runs } from '../primitives.mjs';
import {
  isVec, isKeyword, isRegex, isPath, isQMap, isNull, isBoolean, isNumber, isString, isDocSegment, makeDoc,
  isTag, kindsExpected, makeSet, makeTag, makeTaggedInstance, TAG_HEADER_SYMBOL, BUILTIN_TAG, stampTagHeader
} from '../types.mjs';
import { declareRefusal } from '../errors.mjs';

// `::set[…]` — the set of a vector's elements, the one `distinct`
// mints [QSORD#order], so `::set[3 1 3]`, `#[3 1 3]` and `[3 1 3] | distinct`
// are one value.
const SetPayloadKindNotTakenError = declareRefusal('set/PayloadKindNotTakenError');

function setConstructor(payload) {
  if (!isVec(payload)) throw new SetPayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  return makeSet(payload);
}

bindPrim('set/construct', setConstructor);

// The constructors of the core's kinds [QSLIT#kind], [QSSLF#catalog]: each
// reads a payload of its kind as the value itself, so `::vec[1 2]` and `[1 2]`
// are one value and print as the latter, and a payload of another kind is
// refused at the site, a vector or a map under a tag of its own among them, a
// set's and a quote's too: `payload` reads what stands beneath a tag, and a
// word `toX` turns a value into another kind [QSCND#convert].
const NullPayloadKindNotTakenError      = declareRefusal('null/PayloadKindNotTakenError');
const BooleanPayloadKindNotTakenError   = declareRefusal('boolean/PayloadKindNotTakenError');
const NumberPayloadKindNotTakenError    = declareRefusal('number/PayloadKindNotTakenError');
const StringPayloadKindNotTakenError    = declareRefusal('string/PayloadKindNotTakenError');
const KeywordPayloadKindNotTakenError   = declareRefusal('keyword/PayloadKindNotTakenError');
const RegexPayloadKindNotTakenError     = declareRefusal('regex/PayloadKindNotTakenError');
const PathPayloadKindNotTakenError      = declareRefusal('path/PayloadKindNotTakenError');
const TagPayloadKindNotTakenError       = declareRefusal('tag/PayloadKindNotTakenError');
const VecPayloadKindNotTakenError       = declareRefusal('vec/PayloadKindNotTakenError');
const MapPayloadKindNotTakenError       = declareRefusal('map/PayloadKindNotTakenError');

function coreKindConstructor(isOfKind, ErrorCls) {
  const expected = kindsExpected(ErrorCls.prototype.address.split('/')[0]);
  return payload => {
    if (!isOfKind(payload)) throw new ErrorCls({ expected, actualValue: payload });
    return payload;
  };
}

const isBareVec = payload => isVec(payload) && payload[TAG_HEADER_SYMBOL] === undefined;
const isBareMap = payload => isQMap(payload) && payload[TAG_HEADER_SYMBOL] === undefined;

bindPrim('null/construct',    coreKindConstructor(isNull, NullPayloadKindNotTakenError));
bindPrim('boolean/construct', coreKindConstructor(isBoolean, BooleanPayloadKindNotTakenError));
// A number is a finite double: an answer brought under `::number` that left
// the doubles' range is refused here, once for every word [QSNUM#arithmetic].
const NumberNotFiniteError = declareRefusal('number/NotFiniteError');
const finiteNumber = coreKindConstructor(isNumber, NumberPayloadKindNotTakenError);
bindPrim('number/construct', payload => {
  const number = finiteNumber(payload);
  if (!Number.isFinite(number)) throw new NumberNotFiniteError({});
  return number;
});
bindPrim('string/construct',  coreKindConstructor(isString, StringPayloadKindNotTakenError));
bindPrim('keyword/construct', coreKindConstructor(isKeyword, KeywordPayloadKindNotTakenError));
bindPrim('regex/construct',   coreKindConstructor(isRegex, RegexPayloadKindNotTakenError));
bindPrim('path/construct',    coreKindConstructor(isPath, PathPayloadKindNotTakenError));
bindPrim('tag/construct',     coreKindConstructor(isTag, TagPayloadKindNotTakenError));
bindPrim('vec/construct',     coreKindConstructor(isBareVec, VecPayloadKindNotTakenError));
bindPrim('map/construct',     coreKindConstructor(isBareMap, MapPayloadKindNotTakenError));

// `::desc(…)` — any value turned to descend, its place in the one order
// the reverse of its payload's [QSORD#desc].
const DESC_TAG = makeTag('desc');
bindPrim('desc/construct', payload => makeTaggedInstance(DESC_TAG, payload));

// `::doc[…]` — the doc of a vector of prose strings and quotes [QSSLF#doc], so
// a doc comes apart into its segments and back by `tag`.
const DocPayloadKindNotTakenError     = declareRefusal('doc/PayloadKindNotTakenError');
const DocElementNotSegmentError = declareRefusal('doc/ElementNotSegmentError');

function docConstructor(payload) {
  if (!isVec(payload)) throw new DocPayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  payload.forEach((element, index) => {
    if (!isDocSegment(element)) throw new DocElementNotSegmentError({ index, actualValue: element });
  });
  return makeDoc(payload);
}

bindPrim('doc/construct', docConstructor);

// `::builtin{…}` — the descriptor, the recipe of a word or of a kind that
// a primitive answers, or the value of a name under a label alone [QSBLD#fn],
// [QSBLD#kind], [QSBLD#recipe]; its fields stay flat under its tag.
const BuiltinPayloadKindNotTakenError = declareRefusal('builtin/PayloadKindNotTakenError');

function builtinConstructor(payload) {
  if (!isQMap(payload)) throw new BuiltinPayloadKindNotTakenError({ expected: kindsExpected('map'), actualValue: payload });
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

// `payload` and `within` reside on `::tagged`, each a plain function over the
// tagged value the walk served [QSDSP#walk]; the page of `within` keeps its
// subject's kind, so the answer of its edit mints back under the subject's tag
// [QSDSP#answer], [QSSLF#catalog].
bindPrim('tagged/payload', subject => payloadOf(subject));
bindPrim('tagged/within', runs(['code'], async (subject, code) => await code(payloadOf(subject))));

// `tag` resides on `::any` and reads the state of its call, whose scope holds
// the constructor of the tag [QSDSP#residence]: `value | tag ::Foo` lays the
// tag over the subject, and `[::Foo value] | tag` over the second element of
// the pair it takes apart.
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



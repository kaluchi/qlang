// The constructors of the kinds, each `(payload, state) → value` under
// `qlang/type/<tag>`, and the verbs that lay a tag over a value and
// take it off.

import { mintUnderTag } from './verb.mjs';
import { bindPrim, bindStateReader, bindTypeConstructor } from '../primitives.mjs';
import {
  isVec, isKeyword, isQMap, isNull, isBoolean, isNumber, isString, isDocSegment, makeDoc,
  isTagKeyword, makeSet, typeKeyword, TAG_HEADER_SYMBOL, BUILTIN_TAG, stampTagHeader
} from '../types.mjs';
import {
  declareSubjectError,
  declareElementError,
  declareModifierError
} from '../operand-errors.mjs';
import { declareShapeError } from '../errors.mjs';

// `::set[…]` — the set of a vector's elements, the one `distinct`
// mints [D16], so `::set[3 1 3]`, `#[3 1 3]` and `[3 1 3] | distinct`
// are one value.
const SetPayloadNotVecError = declareSubjectError('SetPayloadNotVecError', '::set', 'vec');

function setConstructor(payload) {
  if (!isVec(payload)) throw new SetPayloadNotVecError(payload);
  return makeSet(payload);
}

bindTypeConstructor('set', setConstructor);

// The constructors of the core's kinds [D32, D33]: each reads its
// payload as the value of its kind, so `::vec[1 2]`, `::qlang/vec[1 2]`
// and `[1 2]` are one value and print as the last, and a payload of
// another kind is refused at the site. A vector or a map under a tag of
// its own reads as the bare one.
const NullPayloadNotNullError       = declareSubjectError('NullPayloadNotNullError',       '::null',    'null');
const BooleanPayloadNotBooleanError = declareSubjectError('BooleanPayloadNotBooleanError', '::boolean', 'boolean');
const NumberPayloadNotNumberError   = declareSubjectError('NumberPayloadNotNumberError',   '::number',  'number');
const StringPayloadNotStringError   = declareSubjectError('StringPayloadNotStringError',   '::string',  'string');
const KeywordPayloadNotKeywordError = declareSubjectError('KeywordPayloadNotKeywordError', '::keyword', 'keyword');
const TagPayloadNotTagError         = declareSubjectError('TagPayloadNotTagError',         '::tag',     'tag');
const VecPayloadNotVecError         = declareSubjectError('VecPayloadNotVecError',         '::vec',     'vec');
const MapPayloadNotMapError         = declareSubjectError('MapPayloadNotMapError',         '::map',     ['map', 'vec']);

function coreKindConstructor(isOfKind, ErrorCls, bareValueOf = payload => payload) {
  return payload => {
    if (!isOfKind(payload)) throw new ErrorCls(payload);
    return bareValueOf(payload);
  };
}

const bareVecOf = vec => vec[TAG_HEADER_SYMBOL] === undefined ? vec : Object.freeze([...vec]);
const bareMapOf = map => map[TAG_HEADER_SYMBOL] === undefined ? map : new Map(map);

bindTypeConstructor('null',    coreKindConstructor(isNull, NullPayloadNotNullError));
bindTypeConstructor('boolean', coreKindConstructor(isBoolean, BooleanPayloadNotBooleanError));
bindTypeConstructor('number',  coreKindConstructor(isNumber, NumberPayloadNotNumberError));
bindTypeConstructor('string',  coreKindConstructor(isString, StringPayloadNotStringError));
bindTypeConstructor('keyword', coreKindConstructor(isKeyword, KeywordPayloadNotKeywordError));
bindTypeConstructor('tag',     coreKindConstructor(isTagKeyword, TagPayloadNotTagError));
bindTypeConstructor('vec',     coreKindConstructor(isVec, VecPayloadNotVecError, bareVecOf));
// `::map[…]` also builds a map from the vector of its pairs `[key
// value]`, the reverse of `entries`, as a doc comes back from its
// segments: a key is a keyword, or a string or a number naming the
// keyword of its text, as the key of `groupBy` [D130], and of two pairs
// with one key the last wins [D138].
const MapElementNotPairError = declareElementError('MapElementNotPairError', '::map', 'pair');
const MapKeyNotKeywordError  = declareElementError('MapKeyNotKeywordError',  '::map', ['keyword', 'string', 'number']);

function keyNameOfPair(pairKey, index) {
  if (isKeyword(pairKey)) return pairKey.name;
  if (isString(pairKey) || isNumber(pairKey)) return String(pairKey);
  throw new MapKeyNotKeywordError(index, pairKey);
}

function mapConstructor(payload) {
  if (isQMap(payload)) return bareMapOf(payload);
  if (!isVec(payload)) throw new MapPayloadNotMapError(payload);
  const built = new Map();
  payload.forEach((pair, index) => {
    if (!isVec(pair) || pair.length !== 2) throw new MapElementNotPairError(index, pair);
    built.set(keyNameOfPair(pair[0], index), pair[1]);
  });
  return built;
}

bindTypeConstructor('map', mapConstructor);

// `::doc[…]` — the doc of a vector of prose strings and quotes [D94], so
// a doc comes apart into its segments and back by `tag`.
const DocPayloadNotVecError     = declareSubjectError('DocPayloadNotVecError', '::doc', 'vec');
const DocElementNotSegmentError = declareElementError('DocElementNotSegmentError', '::doc', 'segment');

function docConstructor(payload) {
  if (!isVec(payload)) throw new DocPayloadNotVecError(payload);
  payload.forEach((element, index) => {
    if (!isDocSegment(element)) throw new DocElementNotSegmentError(index, element);
  });
  return makeDoc(payload);
}

bindTypeConstructor('doc', docConstructor);

// `::builtin{…}` — the descriptor: the step of a built-in verb that names
// its primitive [D72], the declaration of a kind that names its
// constructor, and the loader's `use` [D79]; its fields stay flat under
// its tag.
const BuiltinPayloadNotMapError = declareSubjectError('BuiltinPayloadNotMapError', '::builtin', 'map');

function builtinConstructor(payload) {
  if (!isQMap(payload)) throw new BuiltinPayloadNotMapError(payload);
  const descriptor = new Map();
  for (const [k, v] of payload) descriptor.set(k, v);
  stampTagHeader(descriptor, BUILTIN_TAG);
  return descriptor;
}

bindTypeConstructor('builtin', builtinConstructor);

declareSubjectError('PayloadSubjectNotTaggedInstanceError', 'payload', 'taggedInstance');
const TagModifierNotTagKeywordError = declareModifierError(
  'TagModifierNotTagKeywordError', 'tag', 2, 'tagKeyword');
const TagBareSubjectShapeError = declareShapeError('TagBareSubjectShapeError',
  ({ actualType, actualLength }) =>
    actualLength === undefined
      ? `tag (bare form) requires a 2-element Vec [tagKeyword, value] subject, got ${actualType.name}`
      : `tag (bare form) requires a 2-element Vec [tagKeyword, value] subject, got Vec of length ${actualLength}`,
  { operand: 'tag', position: 'subject', expectedType: 'vec' }
);

// The value beneath a tag: a copy of the vector or the map without the
// tag, a set's vector among them, or the value a wrapper holds.
function payloadOf(tagged) {
  if (Array.isArray(tagged)) return Object.freeze([...tagged]);
  if (tagged instanceof Map) return new Map(tagged);
  return tagged.payload;
}

// `payload` and `within` reside on `::tagged`, each a plain function
// over the tagged value the head of its verb checked [D72], [D78];
// `within` returns its subject's kind, so the answer of its edit mints
// back under the subject's tag [D41], [D67].
bindPrim('payload', subject => payloadOf(subject));
bindPrim('within', async (subject, code) => await code(payloadOf(subject)));

// `tag` resides on `::qlang/any` and reads the state of its call, whose
// scope holds the constructor of the tag [D79]: `value | tag ::Foo` lays
// the tag over the subject, `tag value ::Foo` over its first modifier,
// the full application [D72], and `[::Foo value] | tag` over the second
// element of the pair it takes apart.
async function mintPair(pair, state) {
  if (!isVec(pair) || pair.length !== 2) {
    throw new TagBareSubjectShapeError({
      actualType: typeKeyword(pair),
      actualValue: pair,
      actualLength: isVec(pair) ? pair.length : undefined
    });
  }
  const [pairTag, value] = pair;
  if (!isTagKeyword(pairTag)) throw new TagModifierNotTagKeywordError(pairTag);
  return await mintUnderTag(state, pairTag, value);
}

bindStateReader('tag', async (subject, tagName, state) =>
  (isNull(tagName) ? await mintPair(subject, state) : await mintUnderTag(state, tagName, subject)));

declareSubjectError('WithinSubjectNotTaggedInstanceError', 'within', 'taggedInstance');
declareModifierError('WithinCodeNotQuoteError', 'within', 2, 'quote');


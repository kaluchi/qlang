// The constructors of the kinds of the core's values, but those of `::fn`,
// `::kind` and the steps of code, each beside the other words of its kind,
// each `(payload) → value` under the address of the kind's `construct`,
// `number/construct` [QSBLD#kind], [QSWRK#tooling].

import { registerPrimitive } from '../primitives.mjs';
import {
  isVec, isKeyword, isRegex, isPath, isMap, isNull, isBoolean, isNumber, isString, isDocSegment, makeDoc,
  isTag, makeTagged, makeTrace, holdsNoOtherTag, BUILTIN_TAG, DESC_TAG, SET_TAG_NAME, DOC_TAG_NAME, stampTagHeader
} from '../types.mjs';
import { kindsExpected, makeSet } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { framesOfTrace } from '../eval-trace.mjs';
import { quoteOf } from '../steps.mjs';
import { asPrinted } from '../print-value.mjs';

// `::set[…]` — the set of a vector's elements, the one `toSet` answers
// [QSORD#order], [QSCND#convert], so `::set[3 1 3]`, `#[3 1 3]` and `[3 1 3] | toSet`
// are one value.
const SetPayloadKindNotTakenError = declareRefusal('set/PayloadKindNotTakenError');

function setConstructor(payload) {
  if (!isVec(payload) || !holdsNoOtherTag(payload, SET_TAG_NAME)) throw new SetPayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  return makeSet(payload);
}

registerPrimitive('set/construct', setConstructor);

// The constructors of the core's kinds: each reads a payload of its kind as
// the value itself, so `::vec[1 2]` and `[1 2]` are one value and print as
// the latter, and a payload of another kind is refused at the site, a vector
// or a map under a tag of its own among them, a set's and a quote's too:
// `payload` reads what stands beneath a tag, and a verb `toX` turns a value
// into another kind [QSLIT#tag].
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

const isBareVec = payload => isVec(payload) && holdsNoOtherTag(payload, 'vec');
const isBareMap = payload => isMap(payload) && holdsNoOtherTag(payload, 'map');

registerPrimitive('null/construct',    coreKindConstructor(isNull, NullPayloadKindNotTakenError));
registerPrimitive('boolean/construct', coreKindConstructor(isBoolean, BooleanPayloadKindNotTakenError));
// A number is a finite double: an answer brought under `::number` that left
// the doubles' range is refused here, once for every verb [QSNUM#arithmetic].
const NumberNotFiniteError = declareRefusal('number/NotFiniteError');
const finiteNumber = coreKindConstructor(isNumber, NumberPayloadKindNotTakenError);
registerPrimitive('number/construct', payload => {
  const number = finiteNumber(payload);
  if (!Number.isFinite(number)) throw new NumberNotFiniteError({});
  return number;
});
registerPrimitive('string/construct',  coreKindConstructor(isString, StringPayloadKindNotTakenError));
registerPrimitive('keyword/construct', coreKindConstructor(isKeyword, KeywordPayloadKindNotTakenError));
registerPrimitive('regex/construct',   coreKindConstructor(isRegex, RegexPayloadKindNotTakenError));
registerPrimitive('path/construct',    coreKindConstructor(isPath, PathPayloadKindNotTakenError));
registerPrimitive('tag/construct',     coreKindConstructor(isTag, TagPayloadKindNotTakenError));
registerPrimitive('vec/construct',     coreKindConstructor(isBareVec, VecPayloadKindNotTakenError));
registerPrimitive('map/construct',     coreKindConstructor(isBareMap, MapPayloadKindNotTakenError));

// `::desc` over any value turned to descend, `::desc#5`, its place in the
// one order the reverse of its payload's [QSORD#desc].
registerPrimitive('desc/construct', payload => makeTagged(DESC_TAG, payload));

// `::doc[…]` — the doc of a vector of prose strings and quotes [QSSLF#doc], so
// a doc comes apart into its segments and back by `tag`.
const DocPayloadKindNotTakenError = declareRefusal('doc/PayloadKindNotTakenError');
const DocElementNotSegmentError = declareRefusal('doc/ElementNotSegmentError');

function docConstructor(payload) {
  if (!isVec(payload) || !holdsNoOtherTag(payload, DOC_TAG_NAME)) throw new DocPayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  payload.forEach((element, index) => {
    if (!isDocSegment(element)) throw new DocElementNotSegmentError({ index, actualValue: element });
  });
  return makeDoc(payload);
}

registerPrimitive('doc/construct', docConstructor);

// `::quote[…]` — the quote of a vector of steps, under `tag ::quote` and
// after every transform of a quote alike, the rules of a step held where it
// is made [QSQUO#step].
registerPrimitive('quote/construct', payload => quoteOf(payload, asPrinted));

// `::trace[…]` — the trace of a failure, its frames in the order it flew [QSERR#trace].
registerPrimitive('trace/construct', payload => makeTrace(framesOfTrace(payload)));

// `::builtin{…}` — the descriptor, the recipe of a verb or the constructor
// of a kind that a primitive answers, or the value of a name under a label
// alone [QSHST#source]; its fields stay flat under its tag.
const BuiltinPayloadKindNotTakenError = declareRefusal('builtin/PayloadKindNotTakenError');

function builtinConstructor(payload) {
  if (!isMap(payload) || !holdsNoOtherTag(payload, BUILTIN_TAG.name)) throw new BuiltinPayloadKindNotTakenError({ expected: kindsExpected('map'), actualValue: payload });
  const descriptor = new Map();
  for (const [k, v] of payload) descriptor.set(k, v);
  stampTagHeader(descriptor, BUILTIN_TAG);
  return descriptor;
}

registerPrimitive('builtin/construct', builtinConstructor);

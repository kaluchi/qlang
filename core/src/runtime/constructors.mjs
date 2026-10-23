// [QSBLD#kind], [QSWRK#tooling]

import { registerPrimitive } from '../primitives.mjs';
import {
  isVec, isKeyword, isRegex, isPath, isMap, isNull, isBoolean, isNumber, isString, isDocSegment, makeDoc,
  isTag, makeTagged, makeTrace, holdsNoOtherTag, TAG_HEADER_SYMBOL, BUILTIN_TAG, DESC_TAG, SET_TAG_NAME, DOC_TAG_NAME, stampTagHeader
} from '../types.mjs';
import { kindsExpected, makeSet } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { framesOfTrace } from '../eval-trace.mjs';
import { quoteOf } from '../steps.mjs';
import { asPrinted } from '../print-value.mjs';

// [QSORD#order], [QSCND#convert]
const SetPayloadKindNotTakenError = declareRefusal('set/PayloadKindNotTakenError');

function setConstructor(payload) {
  if (!isVec(payload) || !holdsNoOtherTag(payload, SET_TAG_NAME)) throw new SetPayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  return makeSet(payload);
}

registerPrimitive('set', setConstructor);

// [QSLIT#tag]
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
const isBareMap = payload => isMap(payload) && payload[TAG_HEADER_SYMBOL] === undefined;

registerPrimitive('null',    coreKindConstructor(isNull, NullPayloadKindNotTakenError));
registerPrimitive('boolean', coreKindConstructor(isBoolean, BooleanPayloadKindNotTakenError));
// [QSNUM#arithmetic]
const NumberNotFiniteError = declareRefusal('number/NotFiniteError');
const finiteNumber = coreKindConstructor(isNumber, NumberPayloadKindNotTakenError);
registerPrimitive('number', payload => {
  const number = finiteNumber(payload);
  if (!Number.isFinite(number)) throw new NumberNotFiniteError({});
  return number;
});
registerPrimitive('string',  coreKindConstructor(isString, StringPayloadKindNotTakenError));
registerPrimitive('keyword', coreKindConstructor(isKeyword, KeywordPayloadKindNotTakenError));
registerPrimitive('regex',   coreKindConstructor(isRegex, RegexPayloadKindNotTakenError));
registerPrimitive('path',    coreKindConstructor(isPath, PathPayloadKindNotTakenError));
registerPrimitive('tag',     coreKindConstructor(isTag, TagPayloadKindNotTakenError));
registerPrimitive('vec',     coreKindConstructor(isBareVec, VecPayloadKindNotTakenError));
registerPrimitive('map',     coreKindConstructor(isBareMap, MapPayloadKindNotTakenError));

// [QSERR#rest]
registerPrimitive('error', facts => facts);

// [QSORD#desc]
registerPrimitive('desc', payload => makeTagged(DESC_TAG, payload));

// [QSSLF#doc]
const DocPayloadKindNotTakenError = declareRefusal('doc/PayloadKindNotTakenError');
const DocElementKindNotTakenError = declareRefusal('doc/ElementKindNotTakenError');

function docConstructor(payload) {
  if (!isVec(payload) || !holdsNoOtherTag(payload, DOC_TAG_NAME)) throw new DocPayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  payload.forEach((element, index) => {
    if (!isDocSegment(element)) throw new DocElementKindNotTakenError({ index, expected: kindsExpected('quote', 'string'), actualValue: element });
  });
  return makeDoc(payload);
}

registerPrimitive('doc', docConstructor);

// [QSQUO#step]
registerPrimitive('quote', payload => quoteOf(payload, asPrinted));

// [QSERR#trace]
registerPrimitive('trace', payload => makeTrace(framesOfTrace(payload)));

// [QSHST#source]
const BuiltinPayloadKindNotTakenError = declareRefusal('builtin/PayloadKindNotTakenError');

function builtinConstructor(payload) {
  if (!isMap(payload) || !holdsNoOtherTag(payload, BUILTIN_TAG.name)) throw new BuiltinPayloadKindNotTakenError({ expected: kindsExpected('map'), actualValue: payload });
  const descriptor = new Map();
  for (const [k, v] of payload) descriptor.set(k, v);
  stampTagHeader(descriptor, BUILTIN_TAG);
  return descriptor;
}

registerPrimitive('builtin', builtinConstructor);

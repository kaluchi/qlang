// Constructors of a quote and of its steps [D8, D47, D54].
//
// `::quote[…]` holds a vector every element of which is a step, and
// runs wherever a vector comes under the tag, `tag ::quote` and every
// transform of a quote included, so the invariant holds after each.
//
// A record or a wrapper is the step its own text reads back as: its
// constructor checks the fields the printer reads against the record's
// schema, prints the step, and reads the text back, so an assembly that
// reads back as another step, or as no step at all, is refused where it
// is made rather than run as a program that means something else.

import { bindPrim } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { deepEqual } from '../equality.mjs';
import { isStep, isElementStep, isCommandStep, printQuoteSource, quoteOfSource } from '../quote.mjs';
import {
  keyword, isQMap, isQuote, isKeyword, isTagKeyword,
  isDoc, makeQuote, makeTaggedInstance, CALL_TAG, PROJ_TAG, BIND_TAG,
  CONSTRUCT_TAG, FAIL_TAG, GROUP_TAG, isVec
} from '../types.mjs';

const QuotePayloadNotVecError = declareRefusal('quote/PayloadNotVecError');
const QuoteElementNotStepError = declareRefusal('quote/ElementNotStepError');

function quoteConstructor(payload) {
  if (!isVec(payload)) throw new QuotePayloadNotVecError({ actualValue: payload });
  payload.forEach((element, index) => {
    if (!isStep(element)) throw new QuoteElementNotStepError({ index, actualValue: element });
  });
  return makeQuote(payload);
}

bindPrim('quote/construct', quoteConstructor);

// The step reads back as itself, or its refusal names the text it
// printed as. Text that reads as no step at all is refused alike.
function readBackOrRefuse(step, ReadBackDiffersError) {
  const printed = printQuoteSource([step]);
  let readBack;
  try {
    readBack = quoteOfSource(printed, 'step-read-back');
  } catch {
    throw new ReadBackDiffersError({ printed });
  }
  if (readBack.length === 1 && deepEqual(readBack[0], step)) return step;
  throw new ReadBackDiffersError({ printed });
}

// ── records ────────────────────────────────────────────────────

const vecOf = isElement => value => isVec(value) && value.every(isElement);
const isSegment = segment => isKeyword(segment) || Number.isInteger(segment);
const isBodyStep = step => isElementStep(step) || isCommandStep(step);

// A record's payload is a Map whose fields each fit the schema, the
// required ones present; the field the refusal names is null when the
// payload itself is no Map.
function recordConstructor(tag, schema, required, PayloadNotSchemaError, ReadBackDiffersError) {
  return payload => {
    if (!isQMap(payload)) {
      throw new PayloadNotSchemaError({ field: null, actualValue: payload });
    }
    for (const fieldName of required) {
      if (!payload.has(fieldName)) {
        throw new PayloadNotSchemaError({ field: keyword(fieldName), actualValue: null });
      }
    }
    for (const [fieldName, fieldValue] of payload) {
      const fits = schema[fieldName];
      if (fits === undefined || !fits(fieldValue)) {
        throw new PayloadNotSchemaError({ field: keyword(fieldName), actualValue: fieldValue });
      }
    }
    return readBackOrRefuse(makeTaggedInstance(tag, payload), ReadBackDiffersError);
  };
}

bindPrim('call/construct', recordConstructor(CALL_TAG,
  { name: isKeyword, modifiers: vecOf(isElementStep) }, ['name'],
  declareRefusal('call/PayloadNotSchemaError'),
  declareRefusal('call/ReadBackDiffersError')));

bindPrim('proj/construct', recordConstructor(PROJ_TAG,
  { path: vecOf(isSegment) }, ['path'],
  declareRefusal('proj/PayloadNotSchemaError'),
  declareRefusal('proj/ReadBackDiffersError')));

bindPrim('bind/construct', recordConstructor(BIND_TAG,
  { name: isKeyword, docs: vecOf(isDoc), body: isBodyStep }, ['name'],
  declareRefusal('bind/PayloadNotSchemaError'),
  declareRefusal('bind/ReadBackDiffersError')));

bindPrim('construct/construct', recordConstructor(CONSTRUCT_TAG,
  { tag: isTagKeyword, payload: isElementStep }, ['tag', 'payload'],
  declareRefusal('construct/PayloadNotSchemaError'),
  declareRefusal('construct/ReadBackDiffersError')));

// ── wrappers ───────────────────────────────────────────────────

// A wrapper's payload is the quote of the step it wraps.
function wrapperConstructor(tag, PayloadNotQuoteError, ReadBackDiffersError) {
  return payload => {
    if (!isQuote(payload)) throw new PayloadNotQuoteError({ actualValue: payload });
    return readBackOrRefuse(makeTaggedInstance(tag, payload), ReadBackDiffersError);
  };
}

bindPrim('fail/construct', wrapperConstructor(FAIL_TAG,
  declareRefusal('fail/PayloadNotQuoteError'),
  declareRefusal('fail/ReadBackDiffersError')));

bindPrim('group/construct', wrapperConstructor(GROUP_TAG,
  declareRefusal('group/PayloadNotQuoteError'),
  declareRefusal('group/ReadBackDiffersError')));

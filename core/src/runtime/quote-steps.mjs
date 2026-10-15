// Constructors of a quote and of its steps [QSQUO#step].
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
  keyword, isQMap, isQuote, isKeyword, isTag,
  isDoc, makeQuote, makeTaggedInstance, CALL_TAG, BIND_TAG,
  CONSTRUCT_TAG, FAIL_TAG, GROUP_TAG, isVec, kindsExpected
} from '../types.mjs';

const QuotePayloadKindNotTakenError = declareRefusal('quote/PayloadKindNotTakenError');
const QuoteElementNotStepError = declareRefusal('quote/ElementNotStepError');
const QuoteReadBackDiffersError = declareRefusal('quote/ReadBackDiffersError');

// The steps read as the text they print as, each a step that reads back
// by itself, so a value assembled after the head, which a step is not
// [QSQUO#step], is refused where it is made.
function quoteConstructor(payload) {
  if (!isVec(payload)) throw new QuotePayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  payload.forEach((element, index) => {
    if (!isStep(element)) throw new QuoteElementNotStepError({ index, actualValue: element });
  });
  const printed = printQuoteSource(payload);
  try {
    quoteOfSource(printed, 'quote-read-back');
  } catch {
    throw new QuoteReadBackDiffersError({ printed });
  }
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

bindPrim('bind/construct', recordConstructor(BIND_TAG,
  { name: isKeyword, docs: vecOf(isDoc), body: isBodyStep }, ['name'],
  declareRefusal('bind/PayloadNotSchemaError'),
  declareRefusal('bind/ReadBackDiffersError')));

bindPrim('construct/construct', recordConstructor(CONSTRUCT_TAG,
  { tag: isTag, payload: isElementStep }, ['tag', 'payload'],
  declareRefusal('construct/PayloadNotSchemaError'),
  declareRefusal('construct/ReadBackDiffersError')));

// ── wrappers ───────────────────────────────────────────────────

// A wrapper's payload is the quote of the step it wraps.
function wrapperConstructor(tag, PayloadKindNotTakenError, ReadBackDiffersError) {
  return payload => {
    if (!isQuote(payload)) throw new PayloadKindNotTakenError({ expected: kindsExpected('quote'), actualValue: payload });
    return readBackOrRefuse(makeTaggedInstance(tag, payload), ReadBackDiffersError);
  };
}

bindPrim('fail/construct', wrapperConstructor(FAIL_TAG,
  declareRefusal('fail/PayloadKindNotTakenError'),
  declareRefusal('fail/ReadBackDiffersError')));

bindPrim('group/construct', wrapperConstructor(GROUP_TAG,
  declareRefusal('group/PayloadKindNotTakenError'),
  declareRefusal('group/ReadBackDiffersError')));

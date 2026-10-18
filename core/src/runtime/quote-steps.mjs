// The constructors of the steps of a quote [QSQUO#step]: a record or a wrapper
// is the step its own text reads back as, its constructor checking the fields
// the printer reads against the record's schema, printing the step and reading
// the text back, so an assembly that reads back as another step, or as no step
// at all, is refused where it is made.

import { registerPrimitive } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { deepEqual } from '../equality.mjs';
import { kindsExpected } from '../ordering.mjs';
import { printQuoteSource } from '../print-value.mjs';
import { quoteOfSource } from '../quote.mjs';
import { RECORD_FIELDS, CALL_TAG, BIND_TAG, CONSTRUCT_TAG, FAIL_TAG, GROUP_TAG } from '../steps.mjs';
import { keyword, isMap, isQuote, makeTagged } from '../types.mjs';

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

// A record's payload is a Map whose fields each fit the schema, the
// required ones present; the field the refusal names is null when the
// payload itself is no Map.
function recordConstructor(tag, PayloadNotSchemaError, ReadBackDiffersError) {
  const { fields: schema, required } = RECORD_FIELDS.get(tag.name);
  return payload => {
    if (!isMap(payload)) {
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
    return readBackOrRefuse(makeTagged(tag, payload), ReadBackDiffersError);
  };
}

registerPrimitive('call/construct', recordConstructor(CALL_TAG,
  declareRefusal('call/PayloadNotSchemaError'),
  declareRefusal('call/ReadBackDiffersError')));

registerPrimitive('bind/construct', recordConstructor(BIND_TAG,
  declareRefusal('bind/PayloadNotSchemaError'),
  declareRefusal('bind/ReadBackDiffersError')));

registerPrimitive('construct/construct', recordConstructor(CONSTRUCT_TAG,
  declareRefusal('construct/PayloadNotSchemaError'),
  declareRefusal('construct/ReadBackDiffersError')));

// ── wrappers ───────────────────────────────────────────────────

// A wrapper's payload is the quote of the step it wraps.
function wrapperConstructor(tag, PayloadKindNotTakenError, ReadBackDiffersError) {
  return payload => {
    if (!isQuote(payload)) throw new PayloadKindNotTakenError({ expected: kindsExpected('quote'), actualValue: payload });
    return readBackOrRefuse(makeTagged(tag, payload), ReadBackDiffersError);
  };
}

registerPrimitive('fail/construct', wrapperConstructor(FAIL_TAG,
  declareRefusal('fail/PayloadKindNotTakenError'),
  declareRefusal('fail/ReadBackDiffersError')));

registerPrimitive('group/construct', wrapperConstructor(GROUP_TAG,
  declareRefusal('group/PayloadKindNotTakenError'),
  declareRefusal('group/ReadBackDiffersError')));

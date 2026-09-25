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

import { bindTypeConstructor } from '../primitives.mjs';
import { declareSubjectError, declareElementError } from '../operand-errors.mjs';
import { declareShapeError } from '../errors.mjs';
import { deepEqual } from '../equality.mjs';
import { isStep, isElementStep, isCommandStep, printQuoteSource, quoteOfSource } from '../quote.mjs';
import {
  keyword, typeKeyword, isQMap, isQuote, isKeyword, isTagKeyword,
  isString, makeQuote, makeTaggedInstance, CALL_TAG, PROJ_TAG, BIND_TAG,
  TAGGED_TAG, EACH_TAG, FAIL_TAG, GROUP_TAG, isVec
} from '../types.mjs';

const QuotePayloadNotVecError = declareSubjectError('QuotePayloadNotVecError', '::quote', 'vec');
const QuoteElementNotStepError = declareElementError('QuoteElementNotStepError', '::quote', 'step');

function quoteConstructor(payload) {
  if (!isVec(payload)) throw new QuotePayloadNotVecError(payload);
  payload.forEach((element, index) => {
    if (!isStep(element)) throw new QuoteElementNotStepError(index, element);
  });
  return makeQuote(payload);
}

bindTypeConstructor('quote', quoteConstructor);

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

const schemaMessage = operand => ({ field, actualType }) => field === null
  ? `${operand} payload must be a Map of its fields, got ${actualType.name}`
  : `${operand} field :${field.name} does not fit the ${operand} schema, got ${actualType.name}`;

const readBackMessage = operand => ({ printed }) =>
  `${operand} prints as ${printed}, which reads back as another step`;

// ── records ────────────────────────────────────────────────────

const vecOf = isElement => value => isVec(value) && value.every(isElement);
const isSegment = segment => isKeyword(segment) || Number.isInteger(segment);
const isBindName = name => isKeyword(name) || isTagKeyword(name);
const isBodyStep = step => isElementStep(step) || isCommandStep(step);

// A record's payload is a Map whose fields each fit the schema, the
// required ones present; the field the refusal names is null when the
// payload itself is no Map.
function recordConstructor(tag, schema, required, PayloadNotSchemaError, ReadBackDiffersError) {
  return payload => {
    if (!isQMap(payload)) {
      throw new PayloadNotSchemaError({ field: null, actualType: typeKeyword(payload), actualValue: payload });
    }
    for (const fieldName of required) {
      if (!payload.has(fieldName)) {
        throw new PayloadNotSchemaError({ field: keyword(fieldName), actualType: typeKeyword(null), actualValue: payload });
      }
    }
    for (const [fieldName, fieldValue] of payload) {
      const fits = schema[fieldName];
      if (fits === undefined || !fits(fieldValue)) {
        throw new PayloadNotSchemaError({ field: keyword(fieldName), actualType: typeKeyword(fieldValue), actualValue: fieldValue });
      }
    }
    return readBackOrRefuse(makeTaggedInstance(tag, payload), ReadBackDiffersError);
  };
}

bindTypeConstructor('call', recordConstructor(CALL_TAG,
  { name: isKeyword, args: vecOf(isElementStep) }, ['name'],
  declareShapeError('CallPayloadNotSchemaError', schemaMessage('::call'), { operand: '::call' }),
  declareShapeError('CallReadBackDiffersError', readBackMessage('::call'), { operand: '::call' })));

bindTypeConstructor('proj', recordConstructor(PROJ_TAG,
  { path: vecOf(isSegment) }, ['path'],
  declareShapeError('ProjPayloadNotSchemaError', schemaMessage('::proj'), { operand: '::proj' }),
  declareShapeError('ProjReadBackDiffersError', readBackMessage('::proj'), { operand: '::proj' })));

bindTypeConstructor('bind', recordConstructor(BIND_TAG,
  { name: isBindName, docs: vecOf(isString), body: isBodyStep }, ['name'],
  declareShapeError('BindPayloadNotSchemaError', schemaMessage('::bind'), { operand: '::bind' }),
  declareShapeError('BindReadBackDiffersError', readBackMessage('::bind'), { operand: '::bind' })));

bindTypeConstructor('tagged', recordConstructor(TAGGED_TAG,
  { tag: isTagKeyword, payload: isElementStep }, ['tag', 'payload'],
  declareShapeError('TaggedPayloadNotSchemaError', schemaMessage('::tagged'), { operand: '::tagged' }),
  declareShapeError('TaggedReadBackDiffersError', readBackMessage('::tagged'), { operand: '::tagged' })));

// ── wrappers ───────────────────────────────────────────────────

// A wrapper's payload is the quote of the step it wraps.
function wrapperConstructor(tag, PayloadNotQuoteError, ReadBackDiffersError) {
  return payload => {
    if (!isQuote(payload)) throw new PayloadNotQuoteError(payload);
    return readBackOrRefuse(makeTaggedInstance(tag, payload), ReadBackDiffersError);
  };
}

bindTypeConstructor('each', wrapperConstructor(EACH_TAG,
  declareSubjectError('EachPayloadNotQuoteError', '::each', 'quote'),
  declareShapeError('EachReadBackDiffersError', readBackMessage('::each'), { operand: '::each' })));

bindTypeConstructor('fail', wrapperConstructor(FAIL_TAG,
  declareSubjectError('FailPayloadNotQuoteError', '::fail', 'quote'),
  declareShapeError('FailReadBackDiffersError', readBackMessage('::fail'), { operand: '::fail' })));

bindTypeConstructor('group', wrapperConstructor(GROUP_TAG,
  declareSubjectError('GroupPayloadNotQuoteError', '::group', 'quote'),
  declareShapeError('GroupReadBackDiffersError', readBackMessage('::group'), { operand: '::group' })));

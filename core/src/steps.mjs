// The steps of code [QSQUO#step]: the records of what computes, and
// the wrappers a step takes on the fail track or in parentheses, each under
// its tag, and the rules their constructors hold.

import {
  keyword, isKeyword, isTag, isRegex, isPath, isDoc, isQuote, isVec, isMap, isSet, isValueClass,
  makeTag, makeTagged, makeQuote, ERROR_TAG, TAG_HEADER_SYMBOL
} from './types.mjs';

export const CALL_TAG      = makeTag('call');
export const BIND_TAG      = makeTag('bind');
export const CONSTRUCT_TAG = makeTag('construct');
export const FAIL_TAG      = makeTag('fail');
export const GROUP_TAG     = makeTag('group');

// The steps of code that stand in a pipeline alone and those that stand
// inside a container too.
const PIPELINE_STEP_TAG_NAMES  = new Set([FAIL_TAG.name, BIND_TAG.name, CALL_TAG.name]);
const ELEMENT_RECORD_TAG_NAMES = new Set([CALL_TAG.name, CONSTRUCT_TAG.name, GROUP_TAG.name]);

export function stepTagOf(step) {
  return step?.[TAG_HEADER_SYMBOL]?.name;
}

// isStep(value) — the one invariant of a quote: every element is a
// step. The fail track, a declaration and any call stand in the quote
// itself; inside a container, a field or a payload a
// step is an element step.
export function isStep(value) {
  return PIPELINE_STEP_TAG_NAMES.has(stepTagOf(value)) || isElementStep(value);
}

// An element step: a literal, a quote, a doc, a container of element steps,
// an error literal's step, the error at rest it spells [QSERR#rest], a group,
// or a record, which counts by its tag since its constructor already read it
// back from its own text. A declaration and a command with modifiers stand in
// a pipeline alone: inside a container the grammar reads each of their words
// as an element of its own.
function isElementStep(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  if (isKeyword(value) || isTag(value) || isRegex(value) || isPath(value) || isDoc(value) || isQuote(value)) return true;
  const errorFields = errorFieldsOf(value);
  if (errorFields !== null) return [...errorFields.values()].every(isElementStep);
  if (isSet(value)) return value.every(isElementStep);
  const stepTag = stepTagOf(value);
  if (stepTag !== undefined) return ELEMENT_RECORD_TAG_NAMES.has(stepTag) && !(stepTag === CALL_TAG.name && value.has('modifiers'));
  if (isVec(value)) return value.every(isElementStep);
  return isMap(value) && [...value.values()].every(isElementStep);
}

// isCommandStep(value) — a command with its modifiers, the step a
// declaration's body may be beside an element step.
export function isCommandStep(value) {
  return stepTagOf(value) === CALL_TAG.name;
}

// The fields of the step of an error literal, a map under `::error`
// beneath the tag the literal writes before its bang [QSERR#rest]; null
// for any other value.
export function errorFieldsOf(value) {
  const fields = isValueClass(value, 'underTag') ? value.payload : value;
  return isMap(fields) && fields[TAG_HEADER_SYMBOL]?.name === ERROR_TAG.name ? fields : null;
}

export function stepRecord(tag, fields) {
  return makeTagged(tag, new Map(fields));
}

// commandStep(name, modifiers) → the step of a command, its name and its
// modifiers, which a quote assembled from data holds as a quote read from
// text holds it.
export function commandStep(name, modifiers) {
  return stepRecord(CALL_TAG, [['name', keyword(name)], ['modifiers', Object.freeze([...modifiers])]]);
}

// tagCallStepOf(tag) → the step `tag ::Tag`, the call a tagged literal
// stands for [QSERR#trace].
export function tagCallStepOf(tag) {
  return commandStep('tag', [tag]);
}

// groupStep(steps) → the step of steps in parentheses.
export function groupStep(steps) {
  return makeTagged(GROUP_TAG, makeQuote(steps));
}

// The fields of each record, each with the rule its value holds, and the
// fields its constructor requires.
const vecOf = isElement => value => isVec(value) && value.every(isElement);
const isBodyStep = step => isElementStep(step) || isCommandStep(step);

export const RECORD_FIELDS = new Map([
  [CALL_TAG.name, { fields: { name: isKeyword, modifiers: vecOf(isElementStep) }, required: ['name'] }],
  [BIND_TAG.name, { fields: { name: isKeyword, docs: vecOf(isDoc), body: isBodyStep }, required: ['name'] }],
  [CONSTRUCT_TAG.name, { fields: { tag: isTag, payload: isElementStep }, required: ['tag', 'payload'] }]
]);

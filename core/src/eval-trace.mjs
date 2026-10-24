// [QSERR#catch], [QSERR#trace], [QSERR#print]

import { isErrorValue, isVec, holdsNoOtherTag, makeErrorValue, makeFrame, makePath, makeQuote, makeTrace, partsOfFrame, holdsTheLayoutOfAFrame, FRAME_TAG, TRACE_TAG } from './types.mjs';
import { kindsExpected } from './ordering.mjs';
import { declareRefusal } from './errors.mjs';
import { errorFromQlang } from './error-convert.mjs';
import { walkToKinds } from './dispatch.mjs';

export const flightOfACall = () => ({ path: null, resumes: false });
export const flightOfThrow = thrown => ({ path: thrown?.part === undefined ? null : makePath(thrown.part.map(String)), resumes: false });

export function atPath(code, error, path) {
  code.flight.path = path;
  return error;
}

// [QSERR#trace]
export const failedOnAPart = error => error.facts.get('trace').some(frame => partsOfFrame(frame).path !== null);

const TracePayloadKindNotTakenError = declareRefusal('trace/PayloadKindNotTakenError');
const TraceElementKindNotTakenError = declareRefusal('trace/ElementKindNotTakenError');

function frameOf(element) {
  const frame = walkToKinds(element, [FRAME_TAG.name])?.served;
  return frame !== undefined && holdsTheLayoutOfAFrame(frame) ? frame : undefined;
}

export function framesOfTrace(payload) {
  if (!isVec(payload) || !holdsNoOtherTag(payload, TRACE_TAG.name)) throw new TracePayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  const frames = payload.map(frameOf);
  const index = frames.findIndex(frame => frame === undefined);
  if (index !== -1) throw new TraceElementKindNotTakenError({ index, expected: kindsExpected(FRAME_TAG.name), actualValue: payload[index] });
  return frames;
}

function heldTrace(error, scope) {
  if (!error.facts.has('trace')) return [error, []];
  try {
    return [error, framesOfTrace(error.facts.get('trace'))];
  } catch (refusal) {
    return [errorFromQlang(refusal, undefined, scope), []];
  }
}

function withTrace(error, frames) {
  const facts = new Map(error.facts).set('trace', makeTrace(frames));
  return makeErrorValue(error.tag, facts, { originalError: error.originalError });
}

function withFrame(error, stepQuote, subject, scope, path) {
  const [held, frames] = heldTrace(error, scope);
  return withTrace(held, [...frames, makeFrame(subject, stepQuote, path)]);
}

export function answerOfStep(answer, stepQuoteOf, subject, scope, flight = null) {
  if (!isErrorValue(answer)) return answer;
  if (flight?.resumes) return withTrace(answer, answer.facts.get('trace'));
  return withFrame(answer, stepQuoteOf(), subject, scope, flight?.path ?? null);
}

export function skipping(error, skippedStep, scope) {
  const [held, frames] = heldTrace(error, scope);
  if (frames.length === 0) return held;
  const { subject, unfinished, path } = partsOfFrame(frames[frames.length - 1]);
  return withTrace(held, [...frames.slice(0, -1), makeFrame(subject, makeQuote([...unfinished, skippedStep]), path)]);
}

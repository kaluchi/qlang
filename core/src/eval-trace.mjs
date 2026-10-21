// The trace of a failure, written in flight: a failure lives in the pipe
// alone, and its `:trace` holds a frame at every step that raised it or
// handed it on, from the step where it arose to the `!|` that catches it,
// a step it skips joining the steps of the last [QSERR#catch], [QSERR#trace]. The helpers build a
// new error for every change; none re-enters the evaluator.
//
//   `answerOfStep(answer, stepQuoteOf, subject, scope, flight)` — the answer
//     of a step of a pipeline: a failure its subject was not passes a frame
//     there at the place the flight of its call names, unless it resumes.
//   `skipping(error, skippedStep, scope)` — the failure that skipped a step.
//   `flightOfACall()`, `flightOfThrow(thrown)` — the place and the resumption a call answers beside its failure, a throw the part its refusal names.
//   `atPlace(code, error, place)` — the failure of the code of a call at a part.
//
// A failure holds its trace from its first frame, and the refusal of the
// text of a query, which flew no step, holds no `:trace` [QSERR#trace],
// [QSERR#print].

import { isErrorValue, isVec, holdsNoOtherTag, makeErrorValue, makeFrame, makePath, makeQuote, makeTrace, partsOfFrame, holdsTheLayoutOfAFrame, FRAME_TAG, TRACE_TAG } from './types.mjs';
import { kindsExpected } from './ordering.mjs';
import { declareRefusal } from './errors.mjs';
import { errorFromQlang } from './error-convert.mjs';
import { walkToKinds } from './dispatch.mjs';

export const flightOfACall = () => ({ place: null, resumes: false });
export const flightOfThrow = thrown => ({ place: thrown?.part === undefined ? null : makePath(thrown.part.map(String)), resumes: false });

export function atPlace(code, error, place) {
  code.flight.place = place;
  return error;
}

// Whether a failure arose in the code a verb ran on a part, a frame naming its place [QSERR#trace].
export const failedOnAPart = error => error.facts.get('trace').some(frame => partsOfFrame(frame).place !== null);

// framesOfTrace(payload) → the frames of a trace, the one check of the
// constructor of `::trace` and of every trace a frame joins, each element
// under its tags a vector of the layout `::frame` holds [QSERR#trace].
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

// The failure and its frames, or in its place the refusal of its trace,
// which names the trace it refused [QSERR#trace].
function heldTrace(error, scope) {
  if (!error.facts.has('trace')) return [error, []];
  try {
    return [error, framesOfTrace(error.facts.get('trace'))];
  } catch (refusal) {
    return [errorFromQlang(refusal, undefined, scope), []];
  }
}

// The error with its frames given, a fresh value.
function withTrace(error, frames) {
  const facts = new Map(error.facts).set('trace', makeTrace(frames));
  return makeErrorValue(error.tag, facts, { originalError: error.originalError });
}

function withFrame(error, stepQuote, subject, scope, place) {
  const [held, frames] = heldTrace(error, scope);
  return withTrace(held, [...frames, makeFrame(subject, stepQuote, place)]);
}

export function answerOfStep(answer, stepQuoteOf, subject, scope, flight = null) {
  if (!isErrorValue(answer)) return answer;
  if (flight?.resumes) return withTrace(answer, answer.facts.get('trace'));
  return withFrame(answer, stepQuoteOf(), subject, scope, flight?.place ?? null);
}

// The failure that skipped a step, its last frame taking the step; one whose
// trace holds no frame, a failure a host hands as the first value of its pipe
// among them, goes on as it is, and a trace its kind refuses gives way to
// the refusal [QSERR#trace].
export function skipping(error, skippedStep, scope) {
  const [held, frames] = heldTrace(error, scope);
  if (frames.length === 0) return held;
  const { subject, unfinished, place } = partsOfFrame(frames[frames.length - 1]);
  return withTrace(held, [...frames.slice(0, -1), makeFrame(subject, makeQuote([...unfinished, skippedStep]), place)]);
}

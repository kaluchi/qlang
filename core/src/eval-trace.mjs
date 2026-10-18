// The trace of a failure, written in flight: a failure lives in the pipe
// alone, and its `:trace` holds a frame at every step that raised it or
// handed it on, from the step where it arose to the `!|` that catches it,
// a step it skips joining the steps of the last [QSERR#catch], [QSERR#trace]. The helpers build a
// new error for every change; none re-enters the evaluator.
//
//   `answerOfStep(answer, stepQuoteOf, subject, env)` — the answer of a step
//     of a pipeline: a failure its subject was not passes a frame there,
//     unless its maker wrote its trace and it resumes it.
//   `answerOfPart(answer, partNode, subject, env)` — the value a part of a
//     literal answers: a refusal the kind of the part's tag raised passes
//     a frame at the part, and one handed on from inside it goes on as it is.
//   `skipping(error, skippedStep, env)` — the failure that skipped a step.
//   `atPlace(error, place)` — marks a failure at the part a verb's code failed on.
//   `resumingItsTrace(error)` — marks a failure `raise` made of a map
//     that wrote a trace.
//   `raisedBy(error, node)` — marks the failure a node's own fault raised.
//
// A failure holds its trace from its first frame, and the refusal of the
// text of a query, which flew no step, holds no `:trace` [QSERR#trace],
// [QSERR#print].

import { isErrorValue, isPath, isQuote, isTagged, isTrace, isVec, kindsExpected, makeErrorValue, makeFrame, makeQuote, makeTrace, FRAME_TAG } from './types.mjs';
import { quoteOfBody } from './quote.mjs';
import { declareRefusal } from './errors.mjs';
import { errorFromQlang } from './error-convert.mjs';
import { walkToKinds } from './runtime/verb.mjs';

const RESUMING_THEIR_TRACE = new WeakSet();
const RAISED_BY = new WeakMap();
const PLACES = new WeakMap();

export function resumingItsTrace(error) {
  RESUMING_THEIR_TRACE.add(error);
  return error;
}

export function resumesItsTrace(error) {
  return RESUMING_THEIR_TRACE.has(error);
}

export function raisedBy(error, node) {
  RAISED_BY.set(error, node);
  return error;
}

export function isRaisedBy(error, node) {
  return RAISED_BY.get(error) === node;
}

export function atPlace(error, place) {
  PLACES.set(error, place);
  return error;
}

// framesOfTrace(payload) → the frames of a trace, the one check of the
// constructor of `::trace` and of every trace a frame joins, each element
// under its tags a vector of the layout `::frame` holds [QSERR#trace].
const TracePayloadKindNotTakenError = declareRefusal('trace/PayloadKindNotTakenError');
const TraceElementKindNotTakenError = declareRefusal('trace/ElementKindNotTakenError');

function frameOf(element) {
  const frame = walkToKinds(element, [FRAME_TAG.name])?.served;
  return frame?.length <= 3 && isQuote(frame[1]) && frame[1].length > 0 && (frame.length === 2 || isPath(frame[2])) ? frame : undefined;
}

export function framesOfTrace(payload) {
  if (!isVec(payload) || (isTagged(payload) && !isTrace(payload))) throw new TracePayloadKindNotTakenError({ expected: kindsExpected('vec'), actualValue: payload });
  const frames = payload.map(frameOf);
  const index = frames.findIndex(frame => frame === undefined);
  if (index !== -1) throw new TraceElementKindNotTakenError({ index, expected: kindsExpected(FRAME_TAG.name), actualValue: payload[index] });
  return frames;
}

// The failure and its frames, or in its place the refusal of its trace,
// which names the trace it refused [QSERR#trace].
function heldTrace(error, env) {
  if (!error.descriptor.has('trace')) return [error, []];
  try {
    return [error, framesOfTrace(error.descriptor.get('trace'))];
  } catch (refusal) {
    return [errorFromQlang(refusal, undefined, env), []];
  }
}

// The error with its frames given, a fresh value that carries no mark.
function withTrace(error, frames) {
  const descriptor = new Map(error.descriptor).set('trace', makeTrace(frames));
  return makeErrorValue(error.tag, descriptor, { location: error.location, originalError: error.originalError });
}

function withFrame(error, stepQuote, subject, env) {
  const frame = makeFrame(subject, stepQuote, PLACES.get(error) ?? null);
  const [held, frames] = heldTrace(error, env);
  return withTrace(held, [...frames, frame]);
}

export function answerOfStep(answer, stepQuoteOf, subject, env) {
  if (!isErrorValue(answer)) return answer;
  if (resumesItsTrace(answer)) return withTrace(answer, answer.descriptor.get('trace'));
  return withFrame(answer, stepQuoteOf(), subject, env);
}

export function answerOfPart(answer, partNode, subject, env) {
  return isErrorValue(answer) && isRaisedBy(answer, partNode) ? withFrame(answer, quoteOfBody(partNode), subject, env) : answer;
}

// The failure that skipped a step, its last frame taking the step; one whose
// trace holds no frame, a refusal inside a literal before its step answers
// among them, goes on as it is, and a trace its kind refuses gives way to
// the refusal [QSERR#trace].
export function skipping(error, skippedStep, env) {
  const [held, frames] = heldTrace(error, env);
  if (frames.length === 0) return held;
  const [subject, steps, place = null] = frames[frames.length - 1];
  return withTrace(held, [...frames.slice(0, -1), makeFrame(subject, makeQuote([...steps, skippedStep]), place)]);
}

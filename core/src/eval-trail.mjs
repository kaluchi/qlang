// The path of a failure, written in flight: a failure lives in the pipe
// alone [QSERR#catch], and its `:trail` holds a frame at every step that
// raised it or handed it on, from the step where it arose to the `!|` that
// catches it, a step it skips joining the steps of the last [QSERR#trail]. The
// helpers build a new error for every change; none re-enters the evaluator.
//
//   `answerOfStep(answer, stepQuoteOf, subject)` — the answer of a step of
//     a pipeline: a failure its subject was not passes a frame there,
//     unless its maker wrote its trail and it resumes that path.
//   `answerOfPart(answer, partNode, subject)` — the value a part of a
//     literal answers: a refusal the part's constructor raised passes a
//     frame at the part, and one handed on from inside it goes on as it is.
//   `skipping(error, skippedStep)` — the failure that skipped a step.
//   `atPlace(error, place)` — marks a failure at the part a verb's code broke on.
//   `resumingItsTrail(error)` — marks a failure `raise` made of a map
//     that wrote a path.
//   `raisedBy(error, node)` — marks the failure a node's own fault raised.
//
// A failure holds its path from its first frame, and the refusal of the
// text of a query, which flew no step, holds no `:trail` [QSERR#trail].

import { isErrorValue, makeErrorValue, makeFrame, makeQuote, makeTrail } from './types.mjs';
import { quoteOfBody } from './quote.mjs';

const RESUMING_THEIR_TRAIL = new WeakSet();
const RAISED_BY = new WeakMap();
const PLACES = new WeakMap();

export function resumingItsTrail(error) {
  RESUMING_THEIR_TRAIL.add(error);
  return error;
}

export function resumesItsTrail(error) {
  return RESUMING_THEIR_TRAIL.has(error);
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

// The error with its frames given, a fresh value that carries no mark.
function withTrail(error, frames) {
  const descriptor = new Map(error.descriptor).set('trail', makeTrail(frames));
  return makeErrorValue(error.tag, descriptor, { location: error.location, originalError: error.originalError });
}

function withFrame(error, stepQuote, subject) {
  const frame = makeFrame(subject, stepQuote, PLACES.get(error) ?? null);
  return withTrail(error, [...(error.descriptor.get('trail') ?? []), frame]);
}

export function answerOfStep(answer, stepQuoteOf, subject) {
  if (!isErrorValue(answer)) return answer;
  if (resumesItsTrail(answer)) return withTrail(answer, answer.descriptor.get('trail'));
  return withFrame(answer, stepQuoteOf(), subject);
}

export function answerOfPart(answer, partNode, subject) {
  return isErrorValue(answer) && isRaisedBy(answer, partNode) ? withFrame(answer, quoteOfBody(partNode), subject) : answer;
}

// A failure that holds no path, a refusal inside a literal before its step
// answers or one a host hands, holds no frame to join, and the steps it
// passes leave it as it is.
export function skipping(error, skippedStep) {
  const trail = error.descriptor.get('trail');
  if (trail === undefined) return error;
  const [subject, steps, place = null] = trail[trail.length - 1];
  return withTrail(error, [...trail.slice(0, -1), makeFrame(subject, makeQuote([...steps, skippedStep]), place)]);
}

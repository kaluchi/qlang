// The path of a failure, written in flight: a failure lives in the pipe
// alone [QSERR#catch], and its `:trail` holds a stop at every step that
// raised it or handed it on, `{:step :subject :skipped}`, from the step
// where it arose to the `!|` that catches it, and a step it skips joins
// the `:skipped` of the last stop. The helpers build a new error for
// every change; none re-enters the evaluator.
//
//   `answerOfStep(answer, stepQuoteOf, subject)` — the answer of a step of
//     a pipeline: a failure its subject was not passes a stop there,
//     unless its maker wrote its trail and it resumes that path.
//   `answerOfPart(answer, partNode, subject)` — the value a part of a
//     literal answers: a refusal the part's constructor raised passes a
//     stop at the part, and one handed on from inside it goes on as it is.
//   `skipping(error, skippedStep)` — the failure that skipped a step.
//   `resumingItsTrail(error)` — marks a failure `raise` made of a map
//     that wrote its `:trail`.
//   `raisedBy(error, node)` — marks the failure a node's own fault raised.
//
// A failure holds its path from its first stop, and one that flew no step,
// a refusal of the text of a query or one that resumed an empty path,
// holds no `:trail` [QSERR#trail].

import { isErrorValue, makeErrorValue, makeQuote } from './types.mjs';
import { quoteOfBody } from './quote.mjs';

const RESUMING_THEIR_TRAIL = new WeakSet();
const RAISED_BY = new WeakMap();

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

// The error with its trail given, a fresh value that carries no mark.
function withTrail(error, trail) {
  const descriptor = new Map(error.descriptor).set('trail', Object.freeze(trail));
  return makeErrorValue(error.tag, descriptor, { location: error.location, originalError: error.originalError });
}

function withStop(error, stepQuote, subject) {
  const stop = Object.freeze(new Map([['step', stepQuote], ['subject', subject], ['skipped', makeQuote([])]]));
  return withTrail(error, [...(error.descriptor.get('trail') ?? []), stop]);
}

export function answerOfStep(answer, stepQuoteOf, subject) {
  if (!isErrorValue(answer)) return answer;
  if (resumesItsTrail(answer)) return withTrail(answer, answer.descriptor.get('trail') ?? []);
  return withStop(answer, stepQuoteOf(), subject);
}

export function answerOfPart(answer, partNode, subject) {
  return isErrorValue(answer) && isRaisedBy(answer, partNode) ? withStop(answer, quoteOfBody(partNode), subject) : answer;
}

// A failure that flew no step holds no stop to join, and the steps it
// passes leave it as it is.
export function skipping(error, skippedStep) {
  const trail = error.descriptor.get('trail');
  if (trail === undefined) return error;
  const lastStop = trail[trail.length - 1];
  const extended = new Map(lastStop).set('skipped', makeQuote([...lastStop.get('skipped'), skippedStep]));
  return withTrail(error, [...trail.slice(0, -1), Object.freeze(extended)]);
}

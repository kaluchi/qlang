// The path of an error [D85]. Its `:trail` holds a stop at every step
// that raised it or handed it on, `{:step :subject :skipped}`, from the
// step where it arose to the step where it is read, and a step it skips
// joins the `:skipped` of the last stop. The helpers build a new error
// for every change; none re-enters the evaluator.
//
//   `answerOfStep(answer, stepQuoteOf, subject)` — the answer of a step
//     of a pipeline: an error its subject was not passes a stop there,
//     unless its maker wrote its trail and it resumes that path.
//   `answerOfWord(answer, wordNode, subject)` — the value a word of a
//     literal answers: an error the word raised itself passes a stop at
//     the word, any other waits in the container as it is.
//   `skipping(error, skippedStep)` — the error that skipped a step.
//   `resumingItsTrail(error)` — marks an error whose maker, an error
//     literal or `error`, wrote its `:trail`.
//   `raisedBy(error, node)` — marks the error a node's own fault raised.
//
// Every error the runtime makes carries a path. The one value of the
// kind of errors that may carry none is the step of an error literal
// whose `:trail` is no vector of stops, which its quote holds as written
// [D53]: taken out of the quote, it waits in a container as the value it
// is and passes the steps that skip it, having no stop to join, and a
// step that answers it raises the refusal its literal meets when it runs.

import { isErrorValue, isTrail, makeErrorValue, makeQuote, typeKeyword, ErrorTrailNotVecError } from './types.mjs';
import { quoteOfBody } from './quote.mjs';
import { errorFromQlang } from './error-convert.mjs';

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
  return withTrail(error, [...error.descriptor.get('trail'), stop]);
}

export function answerOfStep(answer, stepQuoteOf, subject) {
  if (!isErrorValue(answer)) return answer;
  if (resumesItsTrail(answer)) return withTrail(answer, answer.descriptor.get('trail'));
  return withStop(onItsPath(answer, subject), stepQuoteOf(), subject);
}

// The error a step raises: its answer, or the refusal of the step of an
// error literal that carries no path.
function onItsPath(answer, subject) {
  const trail = answer.descriptor.get('trail');
  if (isTrail(trail)) return answer;
  return errorFromQlang(new ErrorTrailNotVecError({ actualType: typeKeyword(trail), actualValue: trail }), subject);
}

export function answerOfWord(answer, wordNode, subject) {
  if (!isErrorValue(answer)) return answer;
  if (isRaisedBy(answer, wordNode)) return withStop(answer, quoteOfBody(wordNode), subject);
  return resumesItsTrail(answer) ? withTrail(answer, answer.descriptor.get('trail')) : answer;
}

// An error written as a value, which no step has raised or handed on,
// holds no stop, and the steps it passes leave it as it is, as they
// leave the step of an error literal that carries no path.
export function skipping(error, skippedStep) {
  const trail = error.descriptor.get('trail');
  if (!isTrail(trail) || trail.length === 0) return error;
  const lastStop = trail[trail.length - 1];
  const extended = new Map(lastStop).set('skipped', makeQuote([...lastStop.get('skipped'), skippedStep]));
  return withTrail(error, [...trail.slice(0, -1), Object.freeze(extended)]);
}

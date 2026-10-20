// The primitive of `raise`, a verb of `::map` that puts a map on the fail
// track as an error [QSERR#raise].

import { makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { registerReaderOfPassedTags, readingState } from '../primitives.mjs';
import { factsWithTheirTrace } from '../eval.mjs';


// The tag of the raised error is the one its value shows: the outermost
// tag the walk passed, an error at rest's among them, then the one the map
// carries, then the kind of errors; a `:trace` the map writes is laid through
// the label of `::trace` and resumed, as the flight of its call says, an empty
// one none, the raise starting the trace at its own frame [QSERR#trace], [QSERR#raise].
async function raisedFrom(sourceMap, passedTags, state) {
  const tag = passedTags[0] ?? sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const facts = await factsWithTheirTrace(new Map(sourceMap), state);
  state.flight.resumes = facts.has('trace');
  return makeErrorValue(tag, facts);
}

registerReaderOfPassedTags('map/raise', readingState(raisedFrom));

// The primitive of `raise`, a verb of `::map` that puts a map on the fail
// track as an error [QSERR#raise].

import { makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { bindReaderOfPassedTags, readingState } from '../primitives.mjs';
import { resumingItsTrace } from '../eval-trace.mjs';
import { factsWithTheirTrace } from '../eval.mjs';


// The tag of the raised error is the one its value shows: the outermost
// tag the walk passed, an error at rest's among them, then the one the map
// carries, then the kind of errors; a `:trace` the map writes is laid through
// the label of `::trace` and resumed, an empty one none, so the raise starts
// the trace at its own frame [D359], [D360].
async function raisedFrom(sourceMap, passedTags, state) {
  const tag = passedTags[0] ?? sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const facts = await factsWithTheirTrace(new Map(sourceMap), state);
  const raised = makeErrorValue(tag, facts);
  return facts.has('trace') ? resumingItsTrace(raised) : raised;
}

bindReaderOfPassedTags('map/raise', readingState(raisedFrom));

// [QSERR#raise]

import { makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { registerReaderOfPassedTags, readingState } from '../primitives.mjs';
import { factsWithTheirTrace } from '../eval.mjs';


// [QSERR#trace], [QSERR#raise]
async function raisedFrom(sourceMap, passedTags, state) {
  const tag = passedTags[0] ?? sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const facts = await factsWithTheirTrace(new Map(sourceMap), state);
  state.flight.resumes = facts.has('trace');
  return makeErrorValue(tag, facts);
}

registerReaderOfPassedTags('map/raise', readingState(raisedFrom));

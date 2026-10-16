// The primitive of `raise`, a verb of `::map` that puts a map on the fail
// track as an error [QSERR#raise].

import { makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { bindReaderOfPassedTags } from '../primitives.mjs';
import { resumingItsTrail } from '../eval-trail.mjs';


// The tag of the raised error is the one its value shows: the
// outermost tag the walk passed, an opened error's among them, then the
// one the map carries, then the kind of errors; every entry is a fact
// [QSERR#raise]. A map that writes a path resumes it, and an empty
// `:trail`, which the error holds as none, starts the path at the raise
// [QSERR#trail].
function raisedFrom(sourceMap, passedTags) {
  const tag = passedTags[0] ?? sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const minted = makeErrorValue(tag, new Map(sourceMap));
  return minted.descriptor.has('trail') ? resumingItsTrail(minted) : minted;
}

bindReaderOfPassedTags('map/raise', raisedFrom);

// The primitive of `raise`, a verb of `::map` that puts a map on the fail
// track as an error [D97].

import { isTagKeyword, makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { bindReaderOfPassedTags } from '../primitives.mjs';
import { resumingItsTrail } from '../eval-trail.mjs';

declareSubjectError('RaiseSubjectNotMapError', 'raise', 'map');

// The tag of the raised error is the one its value shows [D86]: the
// outermost tag the walk of the head passed on its way to the map, the
// site's of an error `!|` opened among them, so `x !| raise` is `x` and
// `!| tag ::Foo | raise` renames an error; then the one the map carries
// on its header; then a `:kind` entry that names a tag, lifted off the
// map, `{:kind ::Foo …} | raise`; then the kind of errors. A `:kind` of
// another value stays in the map as data. A map that writes `:trail`
// resumes that path; one that writes none raises an error whose path
// starts at the call [D85].
export function raisedFrom(sourceMap, passedTags) {
  let tag = passedTags[0] ?? sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const descriptor = new Map();
  for (const [k, v] of sourceMap) {
    if (k === 'kind' && isTagKeyword(v) && tag === ERROR_TAG) {
      tag = v;
      continue;
    }
    descriptor.set(k, v);
  }
  const minted = makeErrorValue(tag, descriptor);
  return descriptor.has('trail') ? resumingItsTrail(minted) : minted;
}

bindReaderOfPassedTags('raise', raisedFrom);

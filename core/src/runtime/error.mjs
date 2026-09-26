// `error` lifts a map into an error value, a plain function over the map
// the head of its verb checked [D72]; the verb resides on `::map`, and
// `error map` reads its first modifier as the subject.
//
// Error-track dispatch is owned by the `!|` combinator in eval.mjs.
// The verb carries no flag distinguishing "error aware" from ordinary
// verbs; the combinator alone decides which track fires its step, so
// whether a value is an error reads as `false !| true`.
//
// The verb lives in lib/qlang/map.qlang.

import { isTagKeyword, makeErrorValue, ERROR_TAG, TAG_HEADER_SYMBOL } from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { bindReaderOfPassedTags } from '../primitives.mjs';
import { resumingItsTrail } from '../eval-trail.mjs';

declareSubjectError('ErrorDescriptorNotMapError', 'error', 'map');

// The tag of the error is the one its value shows [D86]: the outermost
// tag the walk of the head passed on its way to the map, so
// `!| tag ::Foo | error` renames an error; then the one the map carries
// on its header, the `!|`-materialized descriptor's among them, so
// `error !| … | error` keeps it; then a `:kind` entry that names a tag,
// lifted off the descriptor, `{:kind ::Foo …} | error`; then the kind of
// errors, `::error`. A `:kind` of another value stays in the descriptor
// as data. A map that writes `:trail` resumes that path; one that writes
// none raises an error whose path starts at the call [D85].
bindReaderOfPassedTags('error', (sourceMap, passedTags) => {
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
});

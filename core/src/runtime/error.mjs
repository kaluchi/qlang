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
import { bindPrim } from '../primitives.mjs';

declareSubjectError('ErrorDescriptorNotMapError', 'error', 'map');

// The tag of the error is the one the map carries on its header, the
// `!|`-materialized descriptor's among them, so `error !| … | error`
// keeps it; then a `:kind` entry that names a tag, lifted off the
// descriptor, `{:kind ::Foo …} | error`; then the kind of errors,
// `::error`. A `:kind` of another value stays in the descriptor as data.
bindPrim('error', sourceMap => {
  let tag = sourceMap[TAG_HEADER_SYMBOL] ?? ERROR_TAG;
  const descriptor = new Map();
  for (const [k, v] of sourceMap) {
    if (k === 'kind' && isTagKeyword(v) && tag === ERROR_TAG) {
      tag = v;
      continue;
    }
    descriptor.set(k, v);
  }
  return makeErrorValue(tag, descriptor);
});

// [QSERR#raise]

import { makeErrorValue, makeTag, makeTagged, beneathTags, isMap, isExcerpt, isErrorValue, tagsOver, ERROR_TAG } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { registerStateReader } from '../primitives.mjs';
import { factsWithTheirTrace, layTag } from '../eval.mjs';

const AnyRaiseSubjectKindNotTakenError = declareRefusal('any/raise/SubjectKindNotTakenError');

// [QSERR#trace], [QSERR#raise]
async function raisedFrom(subject, state) {
  const facts = beneathTags(subject);
  if (!isMap(facts) || isExcerpt(facts)) throw new AnyRaiseSubjectKindNotTakenError({ 'subject/expected': kindsExpected('map') });
  const [tagName] = tagsOver(subject);
  const laid = await factsWithTheirTrace(new Map(facts), state);
  if (tagName !== undefined && tagName !== ERROR_TAG.name) {
    const atRest = await layTag(tagName, makeTagged(ERROR_TAG, laid), state);
    if (isErrorValue(atRest)) return atRest;
  }
  state.flight.resumes = laid.has('trace');
  return makeErrorValue(tagName === undefined ? ERROR_TAG : makeTag(tagName), laid);
}

registerStateReader('any/raise', raisedFrom);

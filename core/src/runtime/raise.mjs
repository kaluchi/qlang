// [QSERR#raise]

import { makeErrorValue, makeTag, beneathTags, isMap, tagsOver, ERROR_TAG } from '../types.mjs';
import { declareRefusal, refusingTheSubject } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { registerStateReader } from '../primitives.mjs';
import { factsWithTheirTrace } from '../eval.mjs';

const AnyRaiseSubjectKindNotTakenError = declareRefusal('any/raise/SubjectKindNotTakenError');

// [QSERR#trace], [QSERR#raise]
async function raisedFrom(subject, state) {
  const facts = beneathTags(subject);
  if (!isMap(facts)) throw refusingTheSubject(new AnyRaiseSubjectKindNotTakenError({ expected: kindsExpected('map'), actualValue: subject }));
  const [tagName] = tagsOver(subject);
  const laid = await factsWithTheirTrace(new Map(facts), state);
  state.flight.resumes = laid.has('trace');
  return makeErrorValue(tagName === undefined ? ERROR_TAG : makeTag(tagName), laid);
}

registerStateReader('any/raise', raisedFrom);

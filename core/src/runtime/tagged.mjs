// [QSDSP#walk]

import { layTag } from '../eval.mjs';
import { registerPrimitive, registerStateReader, runs } from '../primitives.mjs';
import { isVec, isNull, isTag, payloadBeneath, beneathTags } from '../types.mjs';
import { declareRefusal, refusingTheSubject } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';

const AnyTagPairTagKindNotTakenError = declareRefusal('any/tag/PairTagKindNotTakenError');
const AnyTagSubjectNotPairError = declareRefusal('any/tag/SubjectNotPairError');

// [QSDSP#walk], [QSDSP#answer], [QSSLF#catalog]
registerPrimitive('tagged/payload', subject => payloadBeneath(subject));
registerPrimitive('tagged/within', runs(['code'], async (subject, code) => await code(payloadBeneath(subject))));

// [QSDSP#residence], [QSLIT#tag]
async function layTagOfPair(subject, state) {
  const pair = beneathTags(subject);
  if (!isVec(pair) || pair.length !== 2) throw refusingTheSubject(new AnyTagSubjectNotPairError({ actualValue: subject }));
  const [pairTag, value] = pair;
  if (!isTag(beneathTags(pairTag))) throw new AnyTagPairTagKindNotTakenError({ expected: kindsExpected('tag'), actualValue: pairTag });
  return await layTag(beneathTags(pairTag).name, value, state);
}

registerStateReader('any/tag', async (subject, tagName, state) =>
  (isNull(tagName) ? await layTagOfPair(subject, state) : await layTag(tagName.name, subject, state)));

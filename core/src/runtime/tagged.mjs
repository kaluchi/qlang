// The words of `::tagged`, `payload` and `within`, and `tag`, the word of
// `::any` that lays a tag over a value through its label [QSDSP#walk].

import { layTag } from '../eval.mjs';
import { registerPrimitive, registerStateReader, runs } from '../primitives.mjs';
import { isVec, isNull, isTag, payloadBeneath, beneathTags } from '../types.mjs';
import { declareRefusal, refusingTheSubject } from '../errors.mjs';

const AnyTagPairTagNotTagError = declareRefusal('any/tag/PairTagNotTagError');
const AnyTagSubjectNotPairError = declareRefusal('any/tag/SubjectNotPairError');

// `payload` and `within` reside on `::tagged`, each taking the values alone,
// the tagged value the walk served first [QSDSP#walk]; the page of `within` keeps its
// subject's kind, so the answer of its edit is laid back under the subject's tag
// [QSDSP#answer], [QSSLF#catalog].
registerPrimitive('tagged/payload', subject => payloadBeneath(subject));
registerPrimitive('tagged/within', runs(['code'], async (subject, code) => await code(payloadBeneath(subject))));

// `tag` resides on `::any` and reads the state of its call, whose scope holds
// the constructor of the tag [QSDSP#residence]: `value | tag ::Foo` lays the
// tag over the subject, and `[::Foo value] | tag` over the second element of
// the pair it takes apart.
async function layTagOfPair(subject, state) {
  const pair = beneathTags(subject);
  if (!isVec(pair) || pair.length !== 2) throw refusingTheSubject(new AnyTagSubjectNotPairError({ actualValue: subject }));
  const [pairTag, value] = pair;
  if (!isTag(beneathTags(pairTag))) throw new AnyTagPairTagNotTagError({ actualValue: pairTag });
  return await layTag(beneathTags(pairTag).name, value, state);
}

registerStateReader('any/tag', async (subject, tagName, state) =>
  (isNull(tagName) ? await layTagOfPair(subject, state) : await layTag(tagName.name, subject, state)));

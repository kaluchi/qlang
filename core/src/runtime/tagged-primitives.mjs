// [QSDSP#walk]

import { layTag } from '../eval.mjs';
import { registerPrimitive, registerStateReader, runsAsCode } from '../primitives.mjs';
import { isNull, isTagged, payloadBeneath, tagOf } from '../types.mjs';

// [QSDSP#walk], [QSDSP#answer], [QSSLF#catalog]
registerPrimitive('tagged/within', runsAsCode(['code'], async (subject, code) => await code(payloadBeneath(subject))));

// [QSLIT#kind], [QSLIT#tag]
registerPrimitive('any/payload', subject => (isTagged(subject) ? payloadBeneath(subject) : subject));

// [QSDSP#residence], [QSLIT#tag]
registerStateReader('any/tag', async (subject, tagName, state) =>
  (isNull(tagName) ? tagOf(subject) : await layTag(tagName.name, subject, state)));

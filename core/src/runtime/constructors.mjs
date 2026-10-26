// [QSBLD#kind], [QSGAT#imports]

import { registerPrimitive } from '../primitives.mjs';
import { isDocSegment, makeDoc, makeTrace, BUILTIN_TAG, stampTagHeader } from '../types.mjs';
import { kindsExpected, makeSet } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { framesOfTrace } from '../eval-trace.mjs';
import { quoteOf } from '../steps.mjs';
import { asPrinted } from '../print-value.mjs';

// [QSORD#order], [QSCND#convert]
registerPrimitive('set', makeSet);

// [QSNUM#arithmetic]
const NumberNotFiniteError = declareRefusal('number/NotFiniteError');
registerPrimitive('number', () => {
  throw new NumberNotFiniteError({});
});

// [QSSLF#doc]
const DocElementKindNotTakenError = declareRefusal('doc/ElementKindNotTakenError');

function docConstructor(payload) {
  payload.forEach((element, index) => {
    if (!isDocSegment(element)) throw new DocElementKindNotTakenError({ expected: kindsExpected('quote', 'string'), found: payload, index });
  });
  return makeDoc(payload);
}

registerPrimitive('doc', docConstructor);

// [QSQUO#step]
registerPrimitive('quote', payload => quoteOf(payload, asPrinted));

// [QSERR#trace]
registerPrimitive('trace', payload => makeTrace(framesOfTrace(payload)));

// [QSHST#source]
function builtinConstructor(payload) {
  const descriptor = new Map(payload);
  stampTagHeader(descriptor, BUILTIN_TAG);
  return descriptor;
}

registerPrimitive('builtin', builtinConstructor);

// [QSCND#compare], [QSCND#boolean]

import { tagOf, pairRefused } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { walkToKinds } from '../dispatch.mjs';

registerPrimitive('any/eq',  (subject, value) => compareValues(subject, value) === 0);
registerPrimitive('any/ne',  (subject, value) => compareValues(subject, value) !== 0);

// [QSCND#compare]
const comparing = holds => (subject, value) => {
  if (tagOf(subject).name !== tagOf(value).name) throw pairRefused(subject, value);
  return holds(compareValues(subject, value));
};

registerPrimitive('any/gt',  comparing(order => order > 0));
registerPrimitive('any/lt',  comparing(order => order < 0));
registerPrimitive('any/gte', comparing(order => order >= 0));
registerPrimitive('any/lte', comparing(order => order <= 0));
registerPrimitive('boolean/and', (subject, condition) => subject && condition);
registerPrimitive('boolean/or',  (subject, condition) => subject || condition);
registerPrimitive('boolean/not', subject => !subject);

// [QSDSP#walk]
registerPrimitive('any/is', (subject, kinds) => walkToKinds(subject, kinds.map(kind => kind.name)) !== null);

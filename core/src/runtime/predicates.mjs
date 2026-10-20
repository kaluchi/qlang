// The primitives of equality, of the comparisons, of the booleans and of the
// kinds, whose verbs the catalog declares under `::any` and `::boolean`
// [QSCND#compare], [QSCND#boolean].

import { typeOf, pairRefused } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { walkToKinds } from '../dispatch.mjs';

registerPrimitive('any/eq',  (subject, value) => compareValues(subject, value) === 0);
registerPrimitive('any/ne',  (subject, value) => compareValues(subject, value) !== 0);

// Two values of one kind, as `type` answers it, compare by the one order, and
// a pair of two kinds is refused with the kinds it met [QSCND#compare], [D388].
const comparing = holds => (subject, value) => {
  if (typeOf(subject).name !== typeOf(value).name) throw pairRefused(subject, value);
  return holds(compareValues(subject, value));
};

registerPrimitive('any/gt',  comparing(order => order > 0));
registerPrimitive('any/lt',  comparing(order => order < 0));
registerPrimitive('any/gte', comparing(order => order >= 0));
registerPrimitive('any/lte', comparing(order => order <= 0));
registerPrimitive('boolean/and', (subject, condition) => subject && condition);
registerPrimitive('boolean/or',  (subject, condition) => subject || condition);
registerPrimitive('boolean/not', subject => !subject);
registerPrimitive('any/type', subject => typeOf(subject));

// Whether the walk of the subject's tags reaches a value of one of the kinds,
// a set read as a vector and a tagged map as a map [QSDSP#walk].
registerPrimitive('any/is', (subject, kinds) => walkToKinds(subject, kinds.map(kind => kind.name)) !== null);

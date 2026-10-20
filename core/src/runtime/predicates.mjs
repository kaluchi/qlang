// The primitives of equality, of the comparisons, of the booleans and of the
// kinds, whose verbs the catalog declares under `::any` and `::boolean`
// [QSCND#compare], [QSCND#boolean].

import { typeOf } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { declareRefusal } from '../errors.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { walkToKinds } from '../dispatch.mjs';

registerPrimitive('any/eq',  (subject, value) => compareValues(subject, value) === 0);
registerPrimitive('any/ne',  (subject, value) => compareValues(subject, value) !== 0);

// Two values of one kind, as `type` answers it, compare by the one order, and
// a pair of two kinds is refused with the kinds it met [QSCND#compare].
const AnyGtKindsMismatchedError = declareRefusal('any/gt/KindsMismatchedError');
const AnyLtKindsMismatchedError = declareRefusal('any/lt/KindsMismatchedError');
const AnyGteKindsMismatchedError = declareRefusal('any/gte/KindsMismatchedError');
const AnyLteKindsMismatchedError = declareRefusal('any/lte/KindsMismatchedError');

const comparing = (KindsMismatchedError, holds) => (subject, value) => {
  const leftType = typeOf(subject);
  const rightType = typeOf(value);
  if (leftType.name !== rightType.name) throw new KindsMismatchedError({ leftType, rightType });
  return holds(compareValues(subject, value));
};

registerPrimitive('any/gt',  comparing(AnyGtKindsMismatchedError, order => order > 0));
registerPrimitive('any/lt',  comparing(AnyLtKindsMismatchedError, order => order < 0));
registerPrimitive('any/gte', comparing(AnyGteKindsMismatchedError, order => order >= 0));
registerPrimitive('any/lte', comparing(AnyLteKindsMismatchedError, order => order <= 0));
registerPrimitive('boolean/and', (subject, condition) => subject && condition);
registerPrimitive('boolean/or',  (subject, condition) => subject || condition);
registerPrimitive('boolean/not', subject => !subject);
registerPrimitive('any/type', subject => typeOf(subject));

// Whether the walk of the subject's tags reaches a value of one of the kinds,
// a set read as a vector and a tagged map as a map [QSDSP#walk].
registerPrimitive('any/is', (subject, kinds) => walkToKinds(subject, kinds.map(kind => kind.name)) !== null);

// The primitives of equality, of the comparisons, of the booleans and of the
// kinds, whose verbs the catalog declares under `::any`, `::boolean` and the
// kinds they compare [QSCND#compare], [QSCND#boolean].

import { typeOf } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { compareValues } from '../ordering.mjs';
import { registerPrimitive } from '../primitives.mjs';
import { walkToKinds } from './verb.mjs';

registerPrimitive('any/eq',  (subject, value) => deepEqual(subject, value));
registerPrimitive('any/ne',  (subject, value) => !deepEqual(subject, value));
registerPrimitive(['tag/gt', 'number/gt', 'string/gt', 'keyword/gt', 'desc/gt'],  (subject, value) => compareValues(subject, value) > 0);
registerPrimitive(['tag/lt', 'number/lt', 'string/lt', 'keyword/lt', 'desc/lt'],  (subject, value) => compareValues(subject, value) < 0);
registerPrimitive(['tag/gte', 'number/gte', 'string/gte', 'keyword/gte', 'desc/gte'], (subject, value) => compareValues(subject, value) >= 0);
registerPrimitive(['tag/lte', 'number/lte', 'string/lte', 'keyword/lte', 'desc/lte'], (subject, value) => compareValues(subject, value) <= 0);
registerPrimitive('boolean/and', (subject, condition) => subject && condition);
registerPrimitive('boolean/or',  (subject, condition) => subject || condition);
registerPrimitive('boolean/not', subject => !subject);
registerPrimitive('any/type', subject => typeOf(subject));

// Whether the walk of the subject's tags reaches a value of one of the kinds,
// a set read as a vector and a tagged map as a map [QSDSP#walk].
registerPrimitive('any/is', (subject, kinds) => walkToKinds(subject, kinds.map(kind => kind.name)) !== null);

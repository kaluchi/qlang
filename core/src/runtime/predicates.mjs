// The primitives of equality, of the comparisons, of the booleans and of the
// kinds, whose words the catalog declares under `::any`, `::boolean` and the
// kinds they compare [QSCND#boolean], [QSLIT#kind], [QSDSP#walk],
// [QSQUO#modifier].

import { typeKeyword } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { compareValues } from '../ordering.mjs';
import { bindPrim } from '../primitives.mjs';
import { walkToKinds } from './verb.mjs';

bindPrim('any/eq',  (subject, value) => deepEqual(subject, value));
bindPrim('any/ne',  (subject, value) => !deepEqual(subject, value));
bindPrim(['tag/gt', 'number/gt', 'string/gt', 'keyword/gt', 'desc/gt'],  (subject, value) => compareValues(subject, value) > 0);
bindPrim(['tag/lt', 'number/lt', 'string/lt', 'keyword/lt', 'desc/lt'],  (subject, value) => compareValues(subject, value) < 0);
bindPrim(['tag/gte', 'number/gte', 'string/gte', 'keyword/gte', 'desc/gte'], (subject, value) => compareValues(subject, value) >= 0);
bindPrim(['tag/lte', 'number/lte', 'string/lte', 'keyword/lte', 'desc/lte'], (subject, value) => compareValues(subject, value) <= 0);
bindPrim('boolean/and', (left, right) => left && right);
bindPrim('boolean/or',  (left, right) => left || right);
bindPrim('boolean/not', subject => !subject);
bindPrim('any/type', subject => typeKeyword(subject));

// Whether the walk of the subject's tags reaches a value of one of the kinds,
// a set read as a vector and a tagged map as a map [QSDSP#walk].
bindPrim('any/is', (subject, kinds) => walkToKinds(subject, kinds.map(kind => kind.name)) !== null);

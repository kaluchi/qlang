// The predicates and the reader of kinds, each a plain function over the
// values the head of its verb checked [D72]: `not`, `and` and `or`
// reside on `::boolean` and take booleans [D14], `eq` and `type` on
// `::any`, and the comparisons on the kinds they compare [D65].
//
// Equality is the shared deepEqual. `type` answers a value's kind, a
// tag: the tag of a tagged value, and for every other value the kind of
// the core its literal implies [D32].
//
// The verbs live in lib/qlang/boolean.qlang, any.qlang and the sources
// of the kinds the comparisons compare.

import { typeKeyword } from '../types.mjs';
import { deepEqual } from '../equality.mjs';
import { compareValues } from '../ordering.mjs';
import { bindPrim } from '../primitives.mjs';
import { walkToKinds } from './verb.mjs';

// The refusals the heads raise at the places they declare.

bindPrim('any/eq',  (subject, value) => deepEqual(subject, value));
bindPrim('any/ne',  (subject, value) => !deepEqual(subject, value));
bindPrim(['tag/gt', 'number/gt', 'string/gt', 'keyword/gt', 'desc/gt'],  (subject, than) => compareValues(subject, than) > 0);
bindPrim(['tag/lt', 'number/lt', 'string/lt', 'keyword/lt', 'desc/lt'],  (subject, than) => compareValues(subject, than) < 0);
bindPrim(['tag/gte', 'number/gte', 'string/gte', 'keyword/gte', 'desc/gte'], (subject, than) => compareValues(subject, than) >= 0);
bindPrim(['tag/lte', 'number/lte', 'string/lte', 'keyword/lte', 'desc/lte'], (subject, than) => compareValues(subject, than) <= 0);
bindPrim('boolean/and', (left, right) => left && right);
bindPrim('boolean/or',  (left, right) => left || right);
bindPrim('boolean/not', subject => !subject);
bindPrim('any/type', subject => typeKeyword(subject));

// Whether the walk of the subject's tags reaches a value of one of the
// kinds, a set read as a vector and a tagged map as a map [D34], [D166].
bindPrim('any/isA', (subject, kinds) => walkToKinds(subject, kinds.map(kind => kind.name)) !== null);

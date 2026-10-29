// [QSCND#compare], [QSCND#boolean]

import { ofTwoKinds, pairRefused, tagsOver, wiringOf } from '../types.mjs';
import { compareValues } from '../ordering.mjs';
import { registerPrimitive, registerStateReader, asCombiner } from '../primitives.mjs';
import { kindOfAValueOf } from '../nouns.mjs';
import { walkToKinds } from '../dispatch.mjs';
import { ownScopeOf } from '../state.mjs';

registerPrimitive('any/eq',  (subject, value) => compareValues(subject, value) === 0);
registerPrimitive('any/ne',  (subject, value) => compareValues(subject, value) !== 0);

// [QSCND#compare]
const comparing = holds => (subject, value) => {
  if (ofTwoKinds(subject, value)) throw pairRefused(subject, value);
  return holds(compareValues(subject, value));
};

registerPrimitive('any/gt',  comparing(order => order > 0));
registerPrimitive('any/lt',  comparing(order => order < 0));
registerPrimitive('any/gte', comparing(order => order >= 0));
registerPrimitive('any/lte', comparing(order => order <= 0));
registerPrimitive('boolean/and', asCombiner((subject, condition) => subject && condition));
registerPrimitive('boolean/or',  asCombiner((subject, condition) => subject || condition));
registerPrimitive('boolean/not', subject => !subject);

// [D483], [QSERR#site]
function closedByOneOf(value, names, scope) {
  const [outer] = tagsOver(value);
  if (outer === undefined || wiringOf(value) === undefined) return false;
  const closing = kindOfAValueOf(scope, outer);
  return closing !== null && names.some(name => kindOfAValueOf(scope, name) === closing);
}

registerStateReader('any/is', (subject, kinds, state) => {
  const names = kinds.map(kind => kind.name);
  return walkToKinds(subject, names) !== null || closedByOneOf(subject, names, ownScopeOf(state));
});

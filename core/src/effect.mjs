// The effect marker: a name whose last segment begins with `@` names an
// effect [D69], `@out` and `any/@out` alike [D153], which the parser
// stamps on every node that names something.

import { splitAddress } from './address.mjs';

export const EFFECT_MARKER_PREFIX = '@';

// A key of a projection may be an index, which carries no marker.
export function classifyEffect(name) {
  return typeof name === 'string' && splitAddress(name)[1].startsWith(EFFECT_MARKER_PREFIX);
}

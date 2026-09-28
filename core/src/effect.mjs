// The effect marker: a name that begins with `@` names an effect [D69],
// which the parser stamps on every node that names something.

export const EFFECT_MARKER_PREFIX = '@';

// A key of a projection may be an index, which carries no marker.
export function classifyEffect(name) {
  return typeof name === 'string' && name.startsWith(EFFECT_MARKER_PREFIX);
}

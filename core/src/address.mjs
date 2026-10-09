// The address of a name, `vec/count`: the noun it is declared under and
// its last name, by which a step calls it [D164]; a name of one segment
// is under no noun.

// splitAddress(name) → `[noun, lastName]`, `['vec', 'count']`, the noun
// null for a name of one segment.
export function splitAddress(name) {
  const cut = name.lastIndexOf('/');
  return cut < 0 ? [null, name] : [name.slice(0, cut), name.slice(cut + 1)];
}

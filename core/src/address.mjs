// splitAddress(name) → the noun a name is declared under and its last
// name, by which a step calls it, `['vec', 'count']` for `vec/count`, the
// noun null for a name of one segment [QSNAM#address].
export function splitAddress(name) {
  const cut = name.lastIndexOf('/');
  return cut < 0 ? [null, name] : [name.slice(0, cut), name.slice(cut + 1)];
}

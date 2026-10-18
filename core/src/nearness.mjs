// The nearness of two names [QSSLF#near]: the names within an edit distance
// of a third of the typed name's length, one at least, and of those the
// nearest alone, in the order of their spelling, an edit an insertion, a
// deletion, a substitution or a swap of two neighbours, the slips of a typing
// hand; beside them, the names one of which begins the other.

function editDistance(typed, known) {
  const table = Array.from({ length: typed.length + 1 }, () => new Array(known.length + 1).fill(0));
  for (let row = 0; row <= typed.length; row++) table[row][0] = row;
  for (let col = 0; col <= known.length; col++) table[0][col] = col;
  for (let row = 1; row <= typed.length; row++) {
    for (let col = 1; col <= known.length; col++) {
      const substitution = typed[row - 1] === known[col - 1] ? 0 : 1;
      table[row][col] = Math.min(
        table[row - 1][col] + 1,
        table[row][col - 1] + 1,
        table[row - 1][col - 1] + substitution);
      const swapped = row > 1 && col > 1
        && typed[row - 1] === known[col - 2] && typed[row - 2] === known[col - 1];
      if (swapped) table[row][col] = Math.min(table[row][col], table[row - 2][col - 2] + 1);
    }
  }
  return table[typed.length][known.length];
}

// One name begins the other, three letters at least: the guess of a longer
// or a shorter name for the same act, `multiply` for `mul` [QSSLF#near].
const PREFIX_LETTERS = 3;
function beginsTheOther(typed, known) {
  return Math.min(typed.length, known.length) >= PREFIX_LETTERS && (typed.startsWith(known) || known.startsWith(typed));
}

// nearestOf(names, typedName) → the nearest of the names, the typed name no
// guess for itself: a name the scope holds yet the asking axis cannot read,
// `:reduce | doc` of a verb only kinds keep, points to the names near it.
export function nearestOf(names, typedName) {
  let nearest = [];
  let nearestDistance = Math.floor(Math.max(typedName.length, 3) / 3);
  const begun = new Set();
  for (const name of names) {
    if (name === typedName) continue;
    if (beginsTheOther(typedName, name)) begun.add(name);
    const distance = editDistance(typedName, name);
    if (distance > nearestDistance) continue;
    if (distance < nearestDistance) {
      nearest = [];
      nearestDistance = distance;
    }
    nearest.push(name);
  }
  return [...new Set([...nearest, ...begun])].sort();
}

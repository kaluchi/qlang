// The names an unresolved name was likely meant to be [D7]: the names
// a step reaches, within an edit distance of a third of the typed name's
// length, one at least, and of those the nearest alone, in the order of
// their spelling. An edit is an insertion, a deletion, a substitution or
// a swap of two neighbours, the slips of a typing hand; beside them, the
// names one of which begins the other, and the words the page of a word
// the typed name begins with links [D118].

import { keyword, makeTag } from './types.mjs';
import { addressesOf, answerOf, nodeAddresses, nodeOf, residenceOnSubject, scopeNamesOf, verbNames, isLabel } from './runtime/nouns.mjs';
import { linkedAddressesOf } from './runtime/doc.mjs';
import { splitAddress } from './address.mjs';

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
// or a shorter name for the same act, `multiply` for `mul` [D118].
const PREFIX_LETTERS = 3;
function beginsTheOther(typed, known) {
  return Math.min(typed.length, known.length) >= PREFIX_LETTERS && (typed.startsWith(known) || known.startsWith(typed));
}

// The nearest of the names, those within a slip of the hand, the nearest
// alone, and beside them those that begin the typed name or that it
// begins, in the order of their spelling. The typed name is no guess for
// itself: a name the scope holds yet the asking axis cannot read, `:reduce
// | doc` of a verb only kinds keep, points to the names near it.
function nearestOf(names, typedName) {
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

// The names a step reaches: those of the scope and the last names of the
// verbs declared under a kind, a label of the root among them as the tag
// that reaches it [D191].
function namesOfSteps(env) {
  return new Set([...scopeNamesOf(env).keys(), ...verbNames(env)]);
}

// The words the page of a word the typed name begins with links, whose
// names end as the typed name goes on past it in a tail of its own,
// capitalised: `add` begins `addOf`, and its page links `sumOf`, the
// word that adds two fields of one record [D118].
function linkedFromBegun(env, typedName, names) {
  const linked = [];
  for (const name of names) {
    const tail = typedName.slice(name.length);
    if (!typedName.startsWith(name) || !/^\p{Lu}/u.test(tail)) continue;
    for (const address of addressesOf(env, name)) {
      for (const doc of nodeOf(env, address.name).get('docs')) {
        const linkedNames = linkedAddressesOf(doc).map(linkedAddress => splitAddress(linkedAddress)[1]);
        linked.push(...linkedNames.filter(linkedName => linkedName.endsWith(tail)));
      }
    }
  }
  return linked;
}

// The names near a typed one, a label of the root that is no word
// written as its tag, and the tag first when the typed name is the
// label's own.
export function nearestNames(env, typedName) {
  const words = new Set(verbNames(env));
  const onlyItsTag = name => !env.has(name) && !words.has(name) && isLabel(env, name);
  const spelled = nearestOf(namesOfSteps(env), typedName);
  const near = [...new Set([...spelled, ...linkedFromBegun(env, typedName, spelled)])].sort()
    .map(name => onlyItsTag(name) ? makeTag(name) : keyword(name));
  return Object.freeze(onlyItsTag(typedName) ? [makeTag(typedName), ...near] : near);
}

// The tags an unknown tag name was likely meant to be [D118]: the
// addresses of the tree's nodes.
export function nearestTagNames(env, typedName) {
  return Object.freeze(nearestOf(new Set(nodeAddresses(env)), typedName).map(name => makeTag(name)));
}

// The keys of a map a key it lacks was likely meant to be, as a name is
// near the names of the scope [D118].
export function nearestKeys(map, typedKey) {
  return Object.freeze(nearestOf(map.keys(), typedKey).map(name => keyword(name)));
}

// The kinds the words at the addresses answer, a word of any value aside.
const answeredKinds = (env, addresses) => new Set(addresses.flatMap(address => answerOf(env, address)?.kinds ?? []).filter(kind => kind !== 'any'));

// nearestWords(env, addresses, subject) → the names the pages of the words
// at the addresses link whose words the subject answers, each a word that
// answers a kind those words answer: the act a step meant by a word the
// kind of its subject lacks, under the name the kind keeps it by, `print`
// for the `toString` of a vector [D118].
export function nearestWords(env, addresses, subject) {
  const kinds = answeredKinds(env, addresses.map(address => address.name));
  const names = new Set();
  for (const address of addresses) {
    for (const doc of nodeOf(env, address.name).get('docs')) {
      for (const linked of linkedAddressesOf(doc)) {
        const name = splitAddress(linked)[1];
        const word = residenceOnSubject(env, name, subject);
        if (word !== null && [...answeredKinds(env, [word.get('name').name])].some(kind => kinds.has(kind))) names.add(name);
      }
    }
  }
  return Object.freeze([...names].sort().map(name => keyword(name)));
}

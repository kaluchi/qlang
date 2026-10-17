// The names an unresolved name was likely meant to be [QSSLF#near]: the
// names a step reaches, within an edit distance of a third of the typed name's
// length, one at least, and of those the nearest alone, in the order of their
// spelling. An edit is an insertion, a deletion, a substitution or a swap of
// two neighbours, the slips of a typing hand; beside them, the names one of
// which begins the other, and the verbs the page of a verb the typed name
// begins with links [D352].

import { keyword, makeTag, isTag } from './types.mjs';
import { ANY_KIND_NAME, addressesOf, answerOf, kindsOfWalk, namesDeclaredUnder, nodeAddresses, nodeOf, residenceOnSubject, scopeNamesOf, verbNames, verbsReaching, isLabel } from './runtime/nouns.mjs';
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
// or a shorter name for the same act, `multiply` for `mul` [QSSLF#near].
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
// that reaches it [QSDSP#residence].
function namesOfSteps(env) {
  return new Set([...scopeNamesOf(env).keys(), ...verbNames(env)]);
}

// The verbs the page of a verb the typed name begins with links, whose
// names end as the typed name goes on past it in a tail of its own,
// capitalised: `add` begins `addOf`, and its page links `sumOf`, the
// verb that adds two fields of one record [D352].
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

// The names near a typed one, a label of the root that is no verb
// written as its tag, and the tag first when the typed name is the
// label's own.
export function nearestNames(env, typedName) {
  const verbs = new Set(verbNames(env));
  const onlyItsTag = name => !env.has(name) && !verbs.has(name) && isLabel(env, name);
  const spelled = nearestOf(namesOfSteps(env), typedName);
  const near = [...new Set([...spelled, ...linkedFromBegun(env, typedName, spelled)])].sort()
    .map(name => onlyItsTag(name) ? makeTag(name) : keyword(name));
  return Object.freeze(onlyItsTag(typedName) ? [makeTag(typedName), ...near] : near);
}

// The tags an unknown tag name was likely meant to be [D352]: the
// addresses of the tree's nodes as deep as the typed name, so a guess at
// a noun meets the nouns, `::str` meeting `::string`, and a guess at a
// verb the verbs, none of the nodes beneath them.
export function nearestTagNames(env, typedName) {
  const depth = typedName.split('/').length;
  const atItsDepth = [...nodeAddresses(env)].filter(address => address.split('/').length === depth);
  return Object.freeze(nearestOf(new Set(atItsDepth), typedName).map(name => makeTag(name)));
}

// The members a subject holds near a name it lacks [D352], read where an
// axis reads a member: the names declared under a tag name's address,
// `::qlang | doc :pipelin` meeting `:pipeline`, and the verbs the walk of
// the subject reaches.
export function nearestMembers(env, subject, memberName) {
  const declared = isTag(subject) ? namesDeclaredUnder(env, subject.name) : [];
  const reached = verbsReaching(env, [...kindsOfWalk(subject)]).keys();
  return Object.freeze(nearestOf(new Set([...declared, ...reached]), memberName).map(name => keyword(name)));
}

// The keys of a map a key it lacks was likely meant to be, as a name is
// near the names of the scope [QSSLF#near].
export function nearestKeys(map, typedKey) {
  return Object.freeze(nearestOf(map.keys(), typedKey).map(name => keyword(name)));
}

// The kinds the verbs at the addresses answer, a verb of any value aside.
const answeredKinds = (env, addresses) => new Set(addresses.flatMap(address => answerOf(env, address)?.kinds ?? []).filter(kind => kind !== ANY_KIND_NAME));

// nearestVerbs(env, addresses, subject) → the names the pages of the verbs
// at the addresses link whose verbs the subject answers, each a verb that
// answers a kind those verbs answer: the act a step meant by a verb the
// kind of its subject lacks, under the name the kind keeps it by, `print`
// for the `toString` of a vector [D352].
export function nearestVerbs(env, addresses, subject) {
  const kinds = answeredKinds(env, addresses.map(address => address.name));
  const names = new Set();
  for (const address of addresses) {
    for (const doc of nodeOf(env, address.name).get('docs')) {
      for (const linked of linkedAddressesOf(doc)) {
        const name = splitAddress(linked)[1];
        const verb = residenceOnSubject(env, name, subject);
        if (verb !== null && [...answeredKinds(env, [verb.get('name').name])].some(kind => kinds.has(kind))) names.add(name);
      }
    }
  }
  return Object.freeze([...names].sort().map(name => keyword(name)));
}

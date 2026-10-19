// The names an unresolved name was likely meant to be [QSSLF#near]: the
// names a step reaches near the typed name, and the verbs the page of a verb
// the typed name begins with links.

import { keyword, makeTag, isTag } from './types.mjs';
import { addressesOf, answerOf, kindsOfWalk, namesDeclaredUnder, nodeAddresses, nodeOf, residenceOnSubject, scopeNamesOf, verbNames, verbsReaching, isLabel } from './nouns.mjs';
import { linkedAddressesOf } from './doc-parts.mjs';
import { splitAddress, ANY_KIND_NAME } from './address.mjs';
import { nearestOf } from './nearness.mjs';

// The names of one segment a step reaches: those of the scope and the last
// names of the verbs declared under a kind, a label of the root among them as
// the tag that reaches it [QSDSP#residence].
function namesOfSteps(scope) {
  return new Set([...scopeNamesOf(scope).keys(), ...verbNames(scope)].filter(name => splitAddress(name)[0] === null));
}

// The verbs the page of a verb the typed name begins with links, whose
// names end as the typed name goes on past it in a tail of its own,
// capitalised: `add` begins `addOf`, and its page links `sumOf`, the
// verb that adds two fields of one record [QSSLF#near].
function linkedFromBegun(scope, typedName, names) {
  const linked = [];
  for (const name of names) {
    const tail = typedName.slice(name.length);
    if (!typedName.startsWith(name) || !/^\p{Lu}/u.test(tail)) continue;
    for (const address of addressesOf(scope, name)) {
      for (const doc of nodeOf(scope, address.name).get('docs')) {
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
export function nearestNames(scope, typedName) {
  const verbs = new Set(verbNames(scope));
  const onlyItsTag = name => !scope.has(name) && !verbs.has(name) && isLabel(scope, name);
  const spelled = nearestOf(namesOfSteps(scope), typedName);
  const near = [...new Set([...spelled, ...linkedFromBegun(scope, typedName, spelled)])].sort()
    .map(name => onlyItsTag(name) ? makeTag(name) : keyword(name));
  return Object.freeze(onlyItsTag(typedName) ? [makeTag(typedName), ...near] : near);
}

// The tags an unknown tag name was likely meant to be [QSSLF#near]: the
// addresses of the tree's nodes as deep as the typed name, so a guess at
// a noun meets the nouns, `::str` meeting `::string`, and a guess at a
// verb the verbs, none of the nodes beneath them.
export function nearestTagNames(scope, typedName) {
  const depth = typedName.split('/').length;
  const atItsDepth = [...nodeAddresses(scope)].filter(address => address.split('/').length === depth);
  return Object.freeze(nearestOf(new Set(atItsDepth), typedName).map(name => makeTag(name)));
}

// The nodes a subject holds near an anchor it holds none under [QSSLF#near], read
// where an axis reads the node under an anchor: the names declared under a
// tag name's address, `::qlang | doc :pipelin` meeting `:pipeline`, and the
// verbs the walk of the subject reaches.
export function nearestNodes(scope, subject, anchorName) {
  const declared = isTag(subject) ? namesDeclaredUnder(scope, subject.name) : [];
  const reached = verbsReaching(scope, [...kindsOfWalk(subject)]).keys();
  return Object.freeze(nearestOf(new Set([...declared, ...reached]), anchorName).map(name => keyword(name)));
}

// The kinds the verbs at the addresses answer, a verb of any value aside.
const answeredKinds = (scope, addresses) => new Set(addresses.flatMap(address => answerOf(scope, address)?.kinds ?? []).filter(kind => kind !== ANY_KIND_NAME));

// nearestVerbs(scope, addresses, subject) → the names the pages of the verbs
// at the addresses link whose verbs the subject answers, each a verb that
// answers a kind those verbs answer: the act a step meant by a verb the
// kind of its subject lacks, under the name the kind keeps it by, `print`
// for the `toString` of a vector [QSDSP#refusal].
export function nearestVerbs(scope, addresses, subject) {
  const kinds = answeredKinds(scope, addresses.map(address => address.name));
  const names = new Set();
  for (const address of addresses) {
    for (const doc of nodeOf(scope, address.name).get('docs')) {
      for (const linked of linkedAddressesOf(doc)) {
        const name = splitAddress(linked)[1];
        const verb = residenceOnSubject(scope, name, subject);
        if (verb !== null && [...answeredKinds(scope, [verb.get('name').name])].some(kind => kinds.has(kind))) names.add(name);
      }
    }
  }
  return Object.freeze([...names].sort().map(name => keyword(name)));
}

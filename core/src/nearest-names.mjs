// [QSSLF#near]

import { keyword, makeTag, isTag } from './types.mjs';
import { addressesOf, answerOf, kindsOfWalk, namesDeclaredUnder, nodeAddresses, nodeOf, residenceOnSubject, scopeNamesOf, verbNames, verbsReaching, isLabel } from './nouns.mjs';
import { linkedAddressesOf } from './doc-parts.mjs';
import { splitAddress, ANY_KIND_NAME } from './address.mjs';
import { nearestOf } from './nearness.mjs';

// [QSDSP#residence]
function namesOfSteps(scope) {
  return new Set([...scopeNamesOf(scope).keys(), ...verbNames(scope)].filter(name => splitAddress(name)[0] === null));
}

// [QSSLF#near]
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

export function nearestNames(scope, typedName) {
  const verbs = new Set(verbNames(scope));
  const onlyItsTag = name => !scope.has(name) && !verbs.has(name) && isLabel(scope, name);
  const spelled = nearestOf(namesOfSteps(scope), typedName);
  const near = [...new Set([...spelled, ...linkedFromBegun(scope, typedName, spelled)])].sort()
    .map(name => onlyItsTag(name) ? makeTag(name) : keyword(name));
  return Object.freeze(onlyItsTag(typedName) ? [makeTag(typedName), ...near] : near);
}

export function nearestTagNames(scope, typedName) {
  const depth = typedName.split('/').length;
  const atItsDepth = [...nodeAddresses(scope)].filter(address => address.split('/').length === depth);
  return Object.freeze(nearestOf(new Set(atItsDepth), typedName).map(name => makeTag(name)));
}

export function nearestNodes(scope, subject, anchorName) {
  const declared = isTag(subject) ? namesDeclaredUnder(scope, subject.name) : [];
  const reached = verbsReaching(scope, [...kindsOfWalk(subject)]).keys();
  return Object.freeze(nearestOf(new Set([...declared, ...reached]), anchorName).map(name => keyword(name)));
}

const answeredKinds = (scope, addresses) => new Set(addresses.flatMap(address => answerOf(scope, address)?.kinds ?? []).filter(kind => kind !== ANY_KIND_NAME));

// [QSDSP#refusal]
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

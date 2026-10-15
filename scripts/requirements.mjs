// Computes where the work stands from the requirements the decisions
// left [QSWRK#journal]. A conformance case names the decision that left it, and a
// requirement the tree does not meet yet is a target. Without an
// argument it prints each target open with the decisions that name it,
// then the decisions carried out, the decisions of the language no case
// names and the open ones, which are still being decided, and the
// decisions a case does not hold, by their domain.
// With decision numbers it prints the records that replace each and
// that each replaces, and its cases, open and met.
//
// Usage: node scripts/requirements.mjs [D<n> ...]

import { join } from 'node:path';
import { readDecisionRecords, replacedWhole, isBeingDecided, JOURNAL } from './decision-records.mjs';

const root = join(import.meta.dirname, '..');

// The records of the decisions and the cases that name them, D1 onward
// and then E1 onward, those of the environment of the work.
const decisions = readDecisionRecords(root);

const askedDecisions = process.argv.slice(2);
if (askedDecisions.length > 0) {
  for (const decision of askedDecisions) {
    const record = decisions.get(decision);
    if (record === undefined) { console.error(`${decision} has no file in ${JOURNAL}: name a record the folder holds [QSWRK#journal]`); process.exit(2); }
    console.log(`${decision} · ${record.domain}`);
    const replaces = [...decisions].filter(([, other]) => other.replacedBy.includes(decision)).map(([other]) => other);
    if (record.replacedBy.length > 0) console.log(`  replaced by          ${record.replacedBy.join(' ')}`);
    if (record.mergedInto.length > 0) console.log(`  merged into          ${record.mergedInto.join(' ')}`);
    const merged = [...decisions].filter(([, other]) => other.mergedInto.includes(decision)).map(([other]) => other);
    if (merged.length > 0) console.log(`  holds merged         ${merged.join(' ')}`);
    if (replaces.length > 0) console.log(`  replaces             ${replaces.join(' ')}`);
    for (const name of record.targets) console.log(`  target  ${name}`);
    for (const name of record.met) console.log(`  met     ${name}`);
  }
} else {
  const decisionsOfTarget = new Map();
  for (const [decision, record] of decisions) {
    for (const name of record.targets) decisionsOfTarget.set(name, [...(decisionsOfTarget.get(name) ?? []), decision]);
  }
  for (const [name, namingDecisions] of decisionsOfTarget) console.log(`target · ${namingDecisions.join(' ')}  ${name}`);
  const decisionsWhere = holds => [...decisions].filter(([, record]) => holds(record)).map(([decision]) => decision);
  const printList = (label, list) => { if (list.length > 0) console.log(`${label}: ${list.join(' ')}`); };
  printList('carried out', decisionsWhere(record => record.met.length > 0 && record.targets.length === 0));
  printList('being decided', decisionsWhere(isBeingDecided));
  printList('replaced', decisionsWhere(replacedWhole));
  // A decision in force of any other domain, a host, the command line or
  // the tooling, is held by the tests of that domain.
  const inForceOf = domain => record => record.domain === domain && !replacedWhole(record) && !record.open;
  const otherDomains = new Set([...decisions.values()].map(record => record.domain)
    .filter(domain => domain !== 'language' && domain !== 'process' && domain !== 'principle'));
  for (const domain of otherDomains) printList(`held by the tests of the ${domain}`, decisionsWhere(inForceOf(domain)));
  printList('rules of work', decisionsWhere(inForceOf('process')));
  printList('principles', decisionsWhere(inForceOf('principle')));
}

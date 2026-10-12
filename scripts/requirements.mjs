// Computes where the work stands from the requirements the decisions
// left [D58]. A conformance case names the decision that left it, and a
// requirement the tree does not meet yet is a target. Without an
// argument it prints the focus, the open targets of the first milestone
// of the route that has any, then the milestones after it, the
// decisions carried out, the decisions of the language no case names,
// which are still being decided, the decisions later records replaced
// in part, and the decisions a case does not hold, by their domain.
// With decision numbers it prints the records that replace each and
// that each replaces, whole or in part, and its cases, open and met.
//
// Usage: node scripts/requirements.mjs [D<n> ...]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readDecisionRecords, replacedWhole, isBeingDecided } from './decision-records.mjs';

const root = join(import.meta.dirname, '..');
const readText = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// The records of the decisions and the cases that name them, D1 onward
// and then E1 onward, those of the environment of the work.
const decisions = readDecisionRecords(root);

// Each milestone of the audit's route names, in the sentence about "the
// targets of" its decisions, whose targets show it reached.
const route = readText(join(root, 'docs', 'qlang-audit.md')).split('\n## The route\n')[1].split('\n## ')[0];
const milestones = route.split(/\n(?=### Milestone )/).slice(1).map(section => {
  const naming = section.replace(/\n/g, ' ').match(/targets? of ((?:\[D\d+\](?:,? and |, )?)+)/);
  return {
    title: section.match(/^### (Milestone [^\n]+)/)[1],
    decisions: naming === null ? [] : [...naming[1].matchAll(/D\d+/g)].map(match => match[0]),
  };
});

const askedDecisions = process.argv.slice(2);
if (askedDecisions.length > 0) {
  for (const decision of askedDecisions) {
    const record = decisions.get(decision);
    if (record === undefined) throw new Error(`${decision} has no file in docs/decisions: a case names the record it holds [D58]`);
    console.log(`${decision} · ${record.domain}`);
    const replaces = inPart => [...decisions].filter(([, other]) => (inPart ? other.replacedInPartBy : other.replacedBy).includes(decision))
      .map(([other]) => other);
    if (record.replacedBy.length > 0) console.log(`  replaced by          ${record.replacedBy.join(' ')}`);
    if (record.mergedInto.length > 0) console.log(`  merged into          ${record.mergedInto.join(' ')}`);
    const merged = [...decisions].filter(([, other]) => other.mergedInto.includes(decision)).map(([other]) => other);
    if (merged.length > 0) console.log(`  holds merged         ${merged.join(' ')}`);
    if (record.replacedInPartBy.length > 0) console.log(`  replaced in part by  ${record.replacedInPartBy.join(' ')}`);
    if (replaces(false).length > 0) console.log(`  replaces             ${replaces(false).join(' ')}`);
    if (replaces(true).length > 0) console.log(`  replaces in part     ${replaces(true).join(' ')}`);
    for (const name of record.targets) console.log(`  target  ${name}`);
    for (const name of record.met) console.log(`  met     ${name}`);
  }
} else {
  const decisionsOfTarget = new Map();
  for (const [decision, record] of decisions) {
    for (const name of record.targets) decisionsOfTarget.set(name, [...(decisionsOfTarget.get(name) ?? []), decision]);
  }
  // A target of several decisions is reached with the last milestone
  // that names one of them.
  const milestoneOfTarget = new Map();
  milestones.forEach((milestone, milestoneIndex) => {
    for (const [name, targetDecisions] of decisionsOfTarget) {
      if (targetDecisions.some(decision => milestone.decisions.includes(decision))) milestoneOfTarget.set(name, milestoneIndex);
    }
  });
  let focusPrinted = false;
  for (const [milestoneIndex, milestone] of milestones.entries()) {
    const openTargets = new Map([...decisionsOfTarget].filter(([name]) => milestoneOfTarget.get(name) === milestoneIndex));
    if (openTargets.size === 0) continue;
    if (focusPrinted) {
      console.log(`later · ${milestone.title}: ${openTargets.size} open`);
      continue;
    }
    console.log(`focus · ${milestone.title}`);
    for (const [name, namingDecisions] of openTargets) console.log(`  ${namingDecisions.join(' ')}  ${name}`);
    focusPrinted = true;
  }
  const decisionsWhere = holds => [...decisions].filter(([, record]) => holds(record)).map(([decision]) => decision);
  const printList = (label, list) => { if (list.length > 0) console.log(`${label}: ${list.join(' ')}`); };
  printList('outside the route', [...new Set([...decisionsOfTarget]
    .filter(([name]) => !milestoneOfTarget.has(name))
    .flatMap(([, targetDecisions]) => targetDecisions))]);
  printList('carried out', decisionsWhere(record => record.met.length > 0 && record.targets.length === 0));
  printList('being decided', decisionsWhere(isBeingDecided));
  printList('replaced', decisionsWhere(replacedWhole));
  printList('replaced in part', decisionsWhere(record => !replacedWhole(record) && record.replacedInPartBy.length > 0));
  // A decision in force of any other domain, a host, the command line or
  // the tooling, is held by the tests of that domain.
  const inForceOf = domain => record => record.domain === domain && !replacedWhole(record);
  const otherDomains = new Set([...decisions.values()].map(record => record.domain)
    .filter(domain => domain !== 'language' && domain !== 'process' && domain !== 'principle'));
  for (const domain of otherDomains) printList(`held by the tests of the ${domain}`, decisionsWhere(inForceOf(domain)));
  printList('rules of work', decisionsWhere(inForceOf('process')));
  printList('principles of the audit', decisionsWhere(inForceOf('principle')));
}

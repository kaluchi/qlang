// Computes where the work stands from the requirements the decisions
// left [D58]. A conformance case names the decision that left it, and a
// requirement the tree does not meet yet is a target. Without an
// argument it prints the focus, the open targets of the first milestone
// of the route that has any, then the milestones after it, the
// decisions carried out, the decisions of the language no case names,
// which are still being decided, and the decisions a case does not
// hold, by their domain. With decision numbers it prints their cases,
// open and met.
//
// Usage: node scripts/requirements.mjs [D<n> ...]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const conformanceDir = join(root, 'core', 'test', 'conformance');
const decisionsDir = join(root, 'docs', 'decisions');
const readText = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const decisions = new Map(readdirSync(decisionsDir)
  .map(fileName => fileName.match(/^D(\d+)\.md$/)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((left, right) => left - right)
  .map(number => {
    const recordText = readText(join(decisionsDir, `D${number}.md`));
    return [`D${number}`, {
      domain: recordText.match(/^Domain\. (\w+)\./m)[1].toLowerCase(),
      replaced: /^Replaced by \[D\d+\]/m.test(recordText),
      met: [],
      targets: [],
    }];
  }));

for (const caseFile of readdirSync(conformanceDir, { recursive: true }).map(String).filter(name => name.endsWith('.jsonl'))) {
  for (const line of readText(join(conformanceDir, caseFile)).split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('//')) continue;
    const conformanceCase = JSON.parse(line);
    for (const decision of [conformanceCase.decision ?? []].flat()) {
      const record = decisions.get(decision);
      if (record === undefined) {
        throw new Error(`${caseFile}: ${conformanceCase.name} names ${decision}, which has no file in docs/decisions`);
      }
      (conformanceCase.target === true ? record.targets : record.met).push(conformanceCase.name);
    }
  }
}

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
    if (record === undefined) throw new Error(`${decision} has no file in docs/decisions`);
    console.log(`${decision} · ${record.domain}`);
    for (const name of record.targets) console.log(`  target  ${name}`);
    for (const name of record.met) console.log(`  met     ${name}`);
  }
} else {
  const routed = new Set(milestones.flatMap(milestone => milestone.decisions));
  let focusPrinted = false;
  for (const milestone of milestones) {
    const openTargets = new Map();
    for (const decision of milestone.decisions) {
      for (const name of decisions.get(decision).targets) openTargets.set(name, [...(openTargets.get(name) ?? []), decision]);
    }
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
  printList('outside the route', decisionsWhere(record => record.targets.length > 0).filter(decision => !routed.has(decision)));
  printList('carried out', decisionsWhere(record => record.met.length > 0 && record.targets.length === 0));
  printList('being decided', decisionsWhere(record => record.domain === 'language' && !record.replaced
    && record.met.length + record.targets.length === 0));
  printList('replaced', decisionsWhere(record => record.replaced));
  printList("held by a host's tests", decisionsWhere(record => record.domain === 'host'));
  printList('rules of work', decisionsWhere(record => record.domain === 'process'));
}

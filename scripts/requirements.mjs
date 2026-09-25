// Lists the requirements the decisions left [D58]: every conformance
// case that names a decision, grouped under it, with the targets the
// tree does not meet yet by name. A decision whose cases hold no target
// is carried out; one without a case states no requirement a case can
// hold. The conformance runner keeps the listing true, since a case
// answers as expected and a target answers otherwise.
//
// Usage: node scripts/requirements.mjs [D<n> ...]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const conformanceDir = join(root, 'core', 'test', 'conformance');
const decisionsDir = join(root, 'docs', 'decisions');

const requirementsByDecision = new Map(readdirSync(decisionsDir)
  .map(fileName => fileName.match(/^D(\d+)\.md$/)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((left, right) => left - right)
  .map(number => [`D${number}`, { met: [], targets: [] }]));

for (const caseFile of readdirSync(conformanceDir, { recursive: true }).map(String).filter(name => name.endsWith('.jsonl'))) {
  for (const line of readFileSync(join(conformanceDir, caseFile), 'utf8').split(/\r?\n/)) {
    if (line.trim() === '' || line.trim().startsWith('//')) continue;
    const conformanceCase = JSON.parse(line);
    for (const decision of [conformanceCase.decision ?? []].flat()) {
      const requirements = requirementsByDecision.get(decision);
      if (requirements === undefined) {
        throw new Error(`${caseFile}: ${conformanceCase.name} names ${decision}, which has no file in docs/decisions`);
      }
      (conformanceCase.target === true ? requirements.targets : requirements.met).push(conformanceCase.name);
    }
  }
}

const askedDecisions = process.argv.slice(2);
for (const [decision, { met, targets }] of requirementsByDecision) {
  if (askedDecisions.length > 0 && !askedDecisions.includes(decision)) continue;
  const state = met.length + targets.length === 0 ? 'no case'
    : targets.length === 0 ? `carried out, ${met.length} met`
    : `${targets.length} open, ${met.length} met`;
  console.log(`${decision.padEnd(4)} ${state}`);
  for (const target of targets) console.log(`     target  ${target}`);
}

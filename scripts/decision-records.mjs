// The records of the decisions [D58], read once for the scripts that
// weigh them: each record with its domain, the records that replace it
// whole or in part, and the cases of the conformance suite that name it,
// met or open. A record of the language that no case names and no record
// replaces whole is still being decided [D226].

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const readText = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// readDecisionRecords(root) → the records by name, D1 onward and then E1
// onward, those of the environment of the work, each
// `{ domain, replacedBy, replacedInPartBy, met, targets }`.
export function readDecisionRecords(root) {
  const decisionsDir = join(root, 'docs', 'decisions');
  const records = new Map(readdirSync(decisionsDir)
    .map(fileName => fileName.match(/^([DE]\d+)\.md$/)?.[1])
    .filter(Boolean)
    .sort((left, right) => left[0].localeCompare(right[0]) || Number(left.slice(1)) - Number(right.slice(1)))
    .map(name => {
      const recordText = readText(join(decisionsDir, `${name}.md`));
      const replacing = inPart => [...recordText.matchAll(new RegExp(`^Replaced ${inPart ? 'in part ' : ''}by (.+)$`, 'gm'))]
        .flatMap(line => [...line[1].split(', under which')[0].matchAll(/[DE]\d+/g)].map(match => match[0]));
      // A walk files a principle and a rule of the tooling under their
      // domain, which holds them where no case can [D226].
      const filedUnder = recordText.match(/^Filed under the (principles|tooling) by \[D\d+\]/m)?.[1];
      return [name, {
        domain: filedUnder === 'principles' ? 'principle' : filedUnder ?? recordText.match(/^Domain\. ([^.]+)\./m)[1].toLowerCase(),
        replacedBy: replacing(false),
        replacedInPartBy: replacing(true),
        met: [],
        targets: [],
      }];
    }));
  const conformanceDir = join(root, 'core', 'test', 'conformance');
  for (const caseFile of readdirSync(conformanceDir, { recursive: true }).map(String).filter(name => name.endsWith('.jsonl'))) {
    for (const line of readText(join(conformanceDir, caseFile)).split('\n')) {
      if (line.trim() === '' || line.trim().startsWith('//')) continue;
      const conformanceCase = JSON.parse(line);
      for (const decision of [conformanceCase.decision ?? []].flat()) {
        const record = records.get(decision);
        if (record === undefined) {
          throw new Error(`${caseFile}: ${conformanceCase.name} names ${decision}, which has no file in docs/decisions: a case names the record it holds [D58]`);
        }
        (conformanceCase.target === true ? record.targets : record.met).push(conformanceCase.name);
      }
    }
  }
  return records;
}

export const replacedWhole = record => record.replacedBy.length > 0;

// Whether a record of the language waits on a case: no case names it and
// no record replaces it whole.
export const isBeingDecided = record => record.domain === 'language' && !replacedWhole(record)
  && record.met.length + record.targets.length === 0;

// Whether the tree holds a record: one of the language a case it meets
// names, or one of another domain, which the tests of its domain hold,
// and neither replaced whole [D226].
export const isHeld = record => !replacedWhole(record)
  && (record.domain === 'language' ? record.met.length > 0 : true);

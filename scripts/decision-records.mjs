// The records of the decisions [D31], read once for the scripts that
// weigh them: each record with its domain, the records that replace it
// whole or in part, and the cases of the conformance suite that name it,
// met or open. A record of the language that no case names and no record
// replaces whole is still being decided [D225].

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const readText = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// The folders of the records: the root holds those in force, and
// `replaced/` those replaced whole, each moved there once [D237].
const recordFolders = root => [join(root, 'docs', 'decisions'), join(root, 'docs', 'decisions', 'replaced')];

// statementsOf(text) → the statements of a record, each `{ text, from, to }`
// over the indices of its lines: a line that opens a field, `Source.` or
// `Replaces in part`, opens one, and the lines after it continue it to a
// blank line or the next field. A statement of fate, which says what
// replaced or took a part of what, is history the record keeps [D227],
// [D237].
export const FIELD_NAMES = ['Domain', 'Decided by', 'Decision', 'Question', 'Source', 'Alternatives', 'Set aside', 'Requirements'];
export const OPEN_RECORD_FIELDS = ['Question', 'Source', 'Alternatives'];
export const DECIDED_RECORD_FIELDS = ['Decided by', 'Decision'];
const FATES = ['Replaces', 'Pruned of what', 'Replaced by', 'Replaced in part by', 'Merged into'];
export const FIELD_OPENS = new RegExp(`^(${FIELD_NAMES.join('|')})\\.`);
export const FATE = new RegExp(`^(${FATES.join('|')}) `);
const FIELD = new RegExp(`${FIELD_OPENS.source}|${FATE.source}`);
// The definition of a link to a record, `[D19]: D19.md`, and no line of
// prose that opens with a citation and a colon.
export const LINK_DEFINITION = /^\[([DE]\d+)\]: \S+\.md$/;

export function statementsOf(text) {
  const statements = [];
  let current = null;
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '' || LINK_DEFINITION.test(line)) { current = null; return; }
    if (current === null || FIELD.test(line)) statements.push(current = { text: line, from: index, to: index });
    else { current.text += ` ${line}`; current.to = index; }
  });
  return statements;
}

// recordPathOf(root, name) → the file of a record, in the root of the
// records or under `replaced/`, or null for a name no record bears.
export function recordPathOf(root, name) {
  return recordFolders(root).map(folder => join(folder, `${name}.md`)).find(path => existsSync(path)) ?? null;
}

// readDecisionRecords(root) → the records by name, D1 onward and then E1
// onward, those of the environment of the work, each
// `{ path, domain, replacedBy, replacedInPartBy, mergedInto, met, targets }`;
// a record merged into the earliest record of its axis is closed whole
// as one replaced is [D237].
export function readDecisionRecords(root) {
  const records = new Map(recordFolders(root)
    .flatMap(folder => (existsSync(folder) ? readdirSync(folder) : [])
      .map(fileName => fileName.match(/^([DE]\d+)\.md$/)?.[1])
      .filter(Boolean)
      .map(name => [name, join(folder, `${name}.md`)]))
    .sort(([left], [right]) => left[0].localeCompare(right[0]) || Number(left.slice(1)) - Number(right.slice(1)))
    .map(([name, path]) => {
      const recordText = readText(path);
      const replacing = inPart => [...recordText.matchAll(new RegExp(`^Replaced ${inPart ? 'in part ' : ''}by (.+)$`, 'gm'))]
        .flatMap(line => [...line[1].split(', under which')[0].matchAll(/[DE]\d+/g)].map(match => match[0]));
      // A walk files a principle and a rule of the tooling under their
      // domain, which holds them where no case can [D225].
      const filedUnder = recordText.match(/^Filed under the (principles|tooling) by \[D\d+\]/m)?.[1];
      return [name, {
        path,
        domain: filedUnder === 'principles' ? 'principle' : filedUnder ?? recordText.match(/^Domain\. ([^.]+)\./m)[1].toLowerCase(),
        replacedBy: replacing(false),
        replacedInPartBy: replacing(true),
        mergedInto: [...recordText.matchAll(/^Merged into (.+)$/gm)].flatMap(line => [...line[1].matchAll(/[DE]\d+/g)].map(match => match[0])),
        open: isOpenText(recordText),
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
          throw new Error(`${caseFile}: ${conformanceCase.name} names ${decision}, which has no file in docs/decisions: a case names the record it holds [D31]`);
        }
        (conformanceCase.target === true ? record.targets : record.met).push(conformanceCase.name);
      }
    }
  }
  return records;
}

export const replacedWhole = record => record.replacedBy.length > 0 || record.mergedInto.length > 0;

// Whether the text of a record holds a question no decision answers yet,
// an open record [D255].
export const isOpenText = text => /^Question\. /m.test(text);

// Whether a record waits on its decision: an open record, or one of the
// language that no case names and no record replaces whole [D255].
export const isBeingDecided = record => !replacedWhole(record)
  && (record.open || (record.domain === 'language' && record.met.length + record.targets.length === 0));

// Whether the tree holds a record: one of the language a case it meets
// names, or one of another domain, which the tests of its domain hold,
// and neither replaced whole [D225].
export const isHeld = record => !replacedWhole(record)
  && (record.domain === 'language' ? record.met.length > 0 : true);

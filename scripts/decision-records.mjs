// The records of the decisions [QSWRK#journal], read once for the scripts that
// weigh them: each record with its domain, the records that replace it
// whole or in part, and the cases of the conformance suite that name it,
// met or open. A record of the language that no case names and no record
// replaces whole is still being decided [QSWRK#baseline].

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readText as textOf } from './tree-reads.mjs';

const readText = path => textOf(path).replace(/\r\n/g, '\n');

// The journal, the apophatic texts of the tree [QSWRK#documents]: the records
// in force at its root, those out of force under `replaced/`, each moved
// there once, and the research under `research/` [QSWRK#journal].
export const JOURNAL = 'docs/journal';
export const REPLACED = `${JOURNAL}/replaced`;
export const RESEARCH = `${JOURNAL}/research`;
const recordFolders = root => [join(root, JOURNAL), join(root, REPLACED)];

// The folders of the research by the form of what each holds
// [QSWRK#review]: a report named after the record that called for it, `D329~2.md`,
// beside the session's reading, `D329~2~reading.md`, or a run of several
// readers, `D323~1/`, its reports and the session's `reading.md` within it.
export const RESEARCH_FOLDERS = [
  { folder: 'design-check', form: 'report' },
  { folder: 'reviews', form: 'report' },
  { folder: 'outside-audit', form: 'report' },
  { folder: 'spec-check', form: 'run' },
  { folder: 'pentimento-audit', form: 'run' },
];
// foldersOfForm(form) → the folders of that form as one alternation of a
// regex.
export const foldersOfForm = form => RESEARCH_FOLDERS.filter(entry => entry.form === form).map(({ folder }) => folder).join('|');

// statementsOf(text) → the statements of a record, each `{ text, from, to }`
// over the indices of its lines: a line that opens a field, `Source.` or
// `Replaces in part`, opens one, and the lines after it continue it to a
// blank line or the next field. A statement of fate, which says what
// replaced or took a part of what, is history the record keeps [QSWRK#journal].

export const FIELD_NAMES = ['Domain', 'Decided by', 'Decision', 'Question', 'Source', 'Alternatives', 'Set aside', 'Requirements', 'Runs'];
export const OPEN_RECORD_FIELDS = ['Question', 'Source', 'Alternatives'];
export const DECIDED_RECORD_FIELDS = ['Decided by', 'Decision'];
const FATES = ['Replaces', 'Pruned of what', 'Replaced by', 'Merged into', 'Dissolved into', 'Filed under the principles by', 'Filed under the tooling by', 'Left at'];
export const FIELD_OPENS = new RegExp(`^(${FIELD_NAMES.join('|')})\\.`);
export const FATE = new RegExp(`^(${FATES.join('|')}) `);
const FIELD = new RegExp(`${FIELD_OPENS.source}|${FATE.source}`);
// A line of the field of runs, its opening or a run under it, which opens
// with the path of its report under `research/`: history the record keeps,
// as a statement of fate is [QSWRK#journal].
export const RUN_LINE = new RegExp(`^(?:Runs\\. |- \`${RESEARCH}/)`);
// The definition of a link to a record, `[D0]: D0.md`, and no line of
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

// The records the runs and the screens of the benchmark the tree holds are
// named after, `D395~cli~sonnet~1.json` and `D395.txt`, the hash of another
// screen beside the number where a run read one [QSWRK#measure].
function measuredIn(root) {
  const benchmark = join(root, 'scripts', 'benchmark');
  const filesOf = dir => (existsSync(dir) ? readdirSync(dir) : []);
  const runs = filesOf(join(benchmark, 'sets')).flatMap(set => filesOf(join(benchmark, 'sets', set, 'runs')));
  return new Set([...runs, ...filesOf(join(benchmark, 'screens'))].map(name => /^(D\d+)[.~]/.exec(name)?.[1]).filter(Boolean));
}

// readDecisionRecords(root) → the records by name, D1 onward and then E1
// onward, those of the environment of the work, each
// `{ path, domain, replacedBy, mergedInto, met, targets, measured }`,
// `measured` whether the tree holds a run or the screen of the measurement it
// is; a record merged into the earliest record of its axis is closed whole
// as one replaced is [QSWRK#journal].
export function readDecisionRecords(root) {
  const measured = measuredIn(root);
  const records = new Map(recordFolders(root)
    .flatMap(folder => (existsSync(folder) ? readdirSync(folder) : [])
      .map(fileName => fileName.match(/^([DE]\d+)\.md$/)?.[1])
      .filter(Boolean)
      .map(name => [name, join(folder, `${name}.md`)]))
    .sort(([left], [right]) => left[0].localeCompare(right[0]) || Number(left.slice(1)) - Number(right.slice(1)))
    .map(([name, path]) => {
      const recordText = readText(path);
      // A walk files a principle and a rule of the tooling under their
      // domain, which holds them where no case can, the record out of force
      // [QSWRK#journal].
      const filedUnder = recordText.match(/^Filed under the (principles|tooling) by \[D\d+\]/m)?.[1];
      return [name, {
        path,
        filed: filedUnder !== undefined,
        // A record that names no domain is out of form, which
        // check:conventions reports [QSWRK#journal].
        domain: filedUnder === 'principles' ? 'principle' : filedUnder ?? recordText.match(/^Domain\. ([^.]+)\./m)?.[1].toLowerCase() ?? null,
        replacedBy: [...recordText.matchAll(/^Replaced by (.+)$/gm)]
          .flatMap(line => [...line[1].split(', under which')[0].matchAll(/[DE]\d+/g)].map(match => match[0])),
        mergedInto: [...recordText.matchAll(/^Merged into (.+)$/gm)].flatMap(line => [...line[1].matchAll(/[DE]\d+/g)].map(match => match[0])),
        // The sections of the specification a record of the journal
        // dissolved into, its change made the order of the baseline [QSWRK#spec].
        dissolvedInto: [...recordText.matchAll(/^Dissolved into (.+)$/gm)].flatMap(line => [...line[1].matchAll(/QS[A-Z]{3}(?:#[a-z-]+)?/g)].map(match => match[0])),
        open: isOpenText(recordText),
        measured: measured.has(name),
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
          throw new Error(`${caseFile}: ${conformanceCase.name} names ${decision}, which has no file in ${JOURNAL}: a case names the record it holds [QSWRK#cases]`);
        }
        (conformanceCase.target === true ? record.targets : record.met).push(conformanceCase.name);
      }
    }
  }
  return records;
}

export const replacedWhole = record => record.replacedBy.length > 0 || record.mergedInto.length > 0 || record.dissolvedInto.length > 0 || record.filed;

// Whether the text of a record holds a question no decision answers yet,
// an open record [QSWRK#journal].
export const isOpenText = text => /^Question\. /m.test(text);

// Whether a record waits on its decision: an open record, or one of the
// language that no case names and no record replaces whole [QSWRK#journal].
export const isBeingDecided = record => !replacedWhole(record)
  && (record.open || (record.domain === 'language' && record.met.length + record.targets.length === 0));

// Whether the tree holds a record: one of the language a case it meets
// names, one of the benchmark a run or the screen of its measurement, or
// one of another domain, which the tests of its domain hold, and neither
// replaced whole [QSWRK#baseline], [QSWRK#measure].
export const isHeld = record => !replacedWhole(record)
  && (record.domain === 'language' ? record.met.length > 0 : record.domain !== 'benchmark' || record.measured);

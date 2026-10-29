// The check of the chapters [QSRVW#audits]: clean readers, each a clean Opus started
// from a directory of its own as the outside audit is, with no CLAUDE.md, no
// memory and no MCP server and no git command but the listing of the files,
// read the specification whole and then check a group of its chapters
// against their cases, the pages of the catalog and the implementation,
// answering `scripts/spec-check-prompt.txt`. A check is called for by a
// record in force, which carries its fates, `--for Dnn`, and its run is
// named after it, `spec-check/D323~1/`, numbered in the order the runs of
// that record ran. The readers run at once; each report is written into the
// run, `<codes>.md`, beneath a line that says how it was made, and the
// session writes its reading beside them, `reading.md`, the fate of each
// finding in it. With `--records`, each record named, an open one or a
// decision before its code [QSRVW#audits], has a clean reader of its own, who
// bootstraps alike and
// critiques the record against the tree, answering
// `scripts/design-check-prompt.txt`, the report landing as the next critique
// of its record, `design-check/D329~3.md`, named after the record as the runs
// of the benchmark are, and the session writing its reading beside it,
// `D329~3~reading.md` [QSRVW#audits]. A report stays while its record is in
// force or a text in force cites it, and leaves with what holds it at the
// closeout [QSWRK#closeout]. The start of the readers, the
// refusals, the numbers and the heads are the ones every run of the
// research shares [QSRVW#readers].
//
// A report opens with its head: what it is and the record that called for
// it, the tree it read and the baseline that tree stood on, when it ran and
// how. The record holds the run under `Runs.`, a line the script writes
// there as it writes the report, with why it ran where `--why` says it, so
// the journal tells what was run for what and when [QSWRK#journal].
//
// Usage: node scripts/spec-check.mjs --for Dnn [--why "…"] [--groups N] [--effort LEVEL] [--dry]
//        node scripts/spec-check.mjs --records D326 D329 [--why "…"] [--effort LEVEL] [--dry]
// `--dry` prints the groups and runs no reader; `--effort` names the effort
// of the readers, `max` where it names none.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RESEARCH } from './decision-records.mjs';
import { WORK_CHAPTERS } from './reconciliation.mjs';
import {
  allowedReading, effortOfTheRun, headOf, holdTheRun, minuteOf, nextRunOf, packByWeight, refuseASecondRun, refuseNoRecordToCritique,
  refuseNoRecordInForce, runLine, startReaders, stillTheTree, treeOfTheRun
} from './research-runs.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const valuesAfter = flag => {
  const at = process.argv.indexOf(flag);
  if (at === -1) return null;
  const rest = process.argv.slice(at + 1);
  const end = rest.findIndex(argument => argument.startsWith('--'));
  return end === -1 ? rest : rest.slice(0, end);
};
const records = valuesAfter('--records');
const calledFor = valuesAfter('--for')?.[0] ?? null;
const why = valuesAfter('--why')?.join(' ') ?? null;
const effort = effortOfTheRun(process.argv);
const form = records === null ? 'run' : 'report';
const checksDir = join(repoRoot, RESEARCH, records === null ? 'spec-check' : 'design-check');
const promptPath = join(repoRoot, 'scripts', records === null ? 'spec-check-prompt.txt' : 'design-check-prompt.txt');
const shown = path => relative(repoRoot, path).replaceAll('\\', '/');

// The chapters in the order of the index: the chapters of the work a group
// of their own [QSRVW#audits], and those of the language packed in that order into
// groups of about one weight, a chapter weighed with its cases by their
// characters.
const groupsAt = process.argv.indexOf('--groups');
const groupCount = groupsAt === -1 ? 6 : Number(process.argv[groupsAt + 1]);
const specDir = join(repoRoot, 'docs', 'spec');
const chapters = [...readFileSync(join(specDir, 'README.md'), 'utf8').matchAll(/\]\((QS[A-Z]{3}-[^)]+\.md)\)/g)].map(match => match[1]);
const casesDir = code => join(repoRoot, 'core', 'test', 'conformance', code);
const weightOf = file => statSync(join(specDir, file)).size
  + (existsSync(casesDir(file.slice(0, 5))) ? readdirSync(casesDir(file.slice(0, 5))).reduce((sum, name) => sum + statSync(join(casesDir(file.slice(0, 5)), name)).size, 0) : 0);
const ofTheWork = file => WORK_CHAPTERS.includes(file.slice(0, 5));
const language = chapters.filter(file => !ofTheWork(file)).map(file => ({ file, weight: weightOf(file) }));
const work = chapters.filter(ofTheWork);
const groups = records !== null ? records.map(record => [record])
  : [...packByWeight(language, groupCount).map(group => group.map(({ file }) => file)), ...(work.length === 0 ? [] : [work])];
for (const record of records ?? []) refuseNoRecordToCritique(repoRoot, record);
if (process.argv.includes('--dry')) {
  for (const group of groups) console.log(group.join(' '));
  process.exit(0);
}
if (records === null) refuseNoRecordInForce(repoRoot, calledFor, 'a check of the chapters');

const { tree, baseline, date, onTheBaseline } = treeOfTheRun(repoRoot);
for (const record of records ?? [calledFor]) refuseASecondRun(checksDir, record, form, tree, shown);
const run = records === null ? join(checksDir, nextRunOf(checksDir, calledFor, form)) : checksDir;
const reportOf = new Map((records ?? []).map(record => [record, `${nextRunOf(checksDir, record, form)}.md`]));

const prompt = readFileSync(promptPath, 'utf8').replaceAll('{{repo}}', repoPath);
const listed = files => {
  const paths = files.map(file => (records === null ? `docs/spec/${file}` : `docs/journal/${file}.md`));
  return paths.length === 1 ? paths[0] : `${paths.slice(0, -1).join(', ')} and ${paths.at(-1)}`;
};
const what = group => (records === null
  ? `A check of the chapters ${group.map(file => `\`${file.slice(0, 5)}\``).join(', ')} for ${calledFor} by a clean Opus answering \`${shown(promptPath)}\`.`
  : `A critique of the record ${group[0]} by a clean Opus answering \`${shown(promptPath)}\`.`);

// The record that called for a run holds it under `Runs.` [QSWRK#journal].
const held = (record, report, started, ended) => holdTheRun(repoRoot, record, runLine({
  report: `${shown(report)}${records === null ? '/' : ''}`,
  kind: records === null ? 'a check of the chapters for it by clean readers, one for each group' : 'a critique of its roads by a clean reader',
  tree, baseline, date, from: minuteOf(started), to: minuteOf(ended), why
}));

// A reader writes the link of a record as the records write it, from the
// root of the journal; in a report it leads there from the folder the
// report stands in, a run's folder of the check of the chapters or the
// folder of the critiques.
const upToTheJournal = records === null ? '../../../' : '../../';
const linkedFromTheRun = answer => answer.replace(/^(\[D\d+\]: )((?:replaced\/)?D\d+\.md)$/gm, `$1${upToTheJournal}$2`);

console.log(`${groups.length} clean readers ${records === null ? 'check the chapters' : 'critique the records'} of ${tree}`);
const firstStarted = new Date();
const codesOf = group => (records === null ? group.map(file => file.slice(0, 5)).join('-') : group[0]);
const answers = await startReaders(repoRoot, {
  prompts: groups.map(group => ({ name: codesOf(group), group, text: prompt.replace(records === null ? '{{group}}' : '{{record}}', listed(group)) })),
  allowed: allowedReading(repoPath),
  workPrefix: 'qlang-spec-check-',
  effort
});
if (!stillTheTree(repoRoot, tree)) process.exit(1);

mkdirSync(run, { recursive: true });
for (const [at, { name, answer, started, ended }] of answers.entries()) {
  if (answer === null) continue;
  const report = join(run, records === null ? `${name}.md` : reportOf.get(name));
  const head = headOf({ what: what(groups[at]), tree, onTheBaseline, date, started, ended, allowed: '`qplay`, `grep` and `git ls-files`', effort });
  writeFileSync(report, `${head}\n\n${linkedFromTheRun(answer)}\n`);
  if (records !== null) held(name, report, started, ended);
  console.log(`${name}: ${shown(report)}${records === null ? '' : `, its reading to stand beside it as ${shown(report).replace(/\.md$/, '~reading.md')}`}`);
}
if (records === null && answers.some(({ answer }) => answer !== null)) {
  held(calledFor, run, firstStarted, new Date());
  console.log(`${shown(run)}: its reading stands beside the reports, every finding with its fate`);
}
if (answers.some(({ answer }) => answer === null)) process.exitCode = 1;

// The check of the chapters [QSWRK#review]: clean readers, each a clean Opus started
// from a directory of its own as the outside audit is, with no CLAUDE.md, no
// memory and no MCP server and the history out of its reach, read the
// specification whole and then check a group of its chapters against their
// cases, the pages of the catalog and the implementation, answering
// `scripts/spec-check-prompt.txt`. A check is called for by a record in
// force, which carries its fates, `--for D323`, and its run is named after
// it, `spec-check/D323~1/`, numbered in the order the runs of that record
// ran. The readers run at once; each report is written into the run,
// `<codes>.md`, beneath a line that says how it was made, and the session
// writes its reading beside them, `reading.md`, the fate of each finding in
// it. With `--records`, each
// open record named has a clean reader of its own, who bootstraps alike and
// critiques the record against the tree, answering
// `scripts/design-check-prompt.txt`, the report landing as the next critique
// of its record, `design-check/D329~3.md`, named after the record as the runs
// of the benchmark are, and the session writing its reading beside it,
// `D329~3~reading.md` [QSWRK#review]. A run stays in its branch, the move of
// the baseline trims the series, and a critique leaves with its record
// [QSWRK#baseline].
//
//
// A report opens with its head: what it is and the record that called for
// it, the tree it read and the baseline that tree stood on, when it ran and
// how. The record holds the run under `Runs.`, a line the script writes
// there as it writes the report, with why it ran where `--why` says it, so
// the journal tells what was run for what and when [QSWRK#journal].
//
// Usage: node scripts/spec-check.mjs --for D323 [--why "…"] [--groups N] [--dry]
//        node scripts/spec-check.mjs --records D326 D327 [--why "…"] [--dry]
// `--dry` prints the groups and runs no reader.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CHILD_ENVIRONMENT, withTheLanguageOf } from './benchmark/child.mjs';
import { baselineOf } from './baseline-walk.mjs';
import { JOURNAL, RESEARCH, isOpenText } from './decision-records.mjs';
import { holdTheRun, runLine } from './research-runs.mjs';

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
const checksDir = join(repoRoot, RESEARCH, records === null ? 'spec-check' : 'design-check');
const promptPath = join(repoRoot, 'scripts', records === null ? 'spec-check-prompt.txt' : 'design-check-prompt.txt');
const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
const shown = path => relative(repoRoot, path).replaceAll('\\', '/');

// The chapters in the order of the index: the chapter of the work a group of
// its own, and those of the language packed in that order into groups of
// about one weight, a chapter weighed with its cases by their characters.
const groupsAt = process.argv.indexOf('--groups');
const groupCount = groupsAt === -1 ? 6 : Number(process.argv[groupsAt + 1]);
const specDir = join(repoRoot, 'docs', 'spec');
const chapters = [...readFileSync(join(specDir, 'README.md'), 'utf8').matchAll(/\]\((QS[A-Z]{3}-[^)]+\.md)\)/g)].map(match => match[1]);
const casesDir = code => join(repoRoot, 'core', 'test', 'conformance', code);
const weightOf = file => statSync(join(specDir, file)).size
  + (existsSync(casesDir(file.slice(0, 5))) ? readdirSync(casesDir(file.slice(0, 5))).reduce((sum, name) => sum + statSync(join(casesDir(file.slice(0, 5)), name)).size, 0) : 0);
const language = chapters.filter(file => !file.startsWith('QSWRK'));
const total = language.reduce((sum, file) => sum + weightOf(file), 0);
const packed = Array.from({ length: groupCount }, () => []);
let before = 0;
for (const file of language) {
  const weight = weightOf(file);
  packed[Math.min(groupCount - 1, Math.floor(((before + weight / 2) * groupCount) / total))].push(file);
  before += weight;
}
const groups = records !== null ? records.map(record => [record])
  : [...packed.filter(group => group.length > 0), ...chapters.filter(file => file.startsWith('QSWRK')).map(file => [file])];
for (const record of records ?? []) {
  const path = join(repoRoot, JOURNAL, `${record}.md`);
  if (!existsSync(path) || !isOpenText(readFileSync(path, 'utf8'))) {
    console.error(`${record} is no open record of the journal: a critique reads a question still open`);
    process.exit(1);
  }
}
if (process.argv.includes('--dry')) {
  for (const group of groups) console.log(group.join(' '));
  process.exit(0);
}
if (records === null && (calledFor === null || !/^D\d+$/.test(calledFor) || !existsSync(join(repoRoot, JOURNAL, `${calledFor}.md`)))) {
  console.error('a check of the chapters is called for by a record in force, which carries its fates: write the record, then run `--for Dnn`');
  process.exit(1);
}

// The reports name the tree they read, so a change no commit holds is
// committed before the check runs.
if (git('status', '--porcelain') !== '') {
  console.error('the tree holds changes no commit names: commit them, so the reports name the tree they read');
  process.exit(1);
}
const tree = git('rev-parse', '--short=8', 'HEAD');
const date = new Date().toISOString().slice(0, 10);
const baseline = baselineOf(repoRoot);
const onTheBaseline = baseline === tree ? 'itself the baseline' : `on the baseline \`${baseline}\``;

// The runs a record called for are numbered in the order they ran,
// `D329~1.md` and `D329~2.md` for its critiques, `D323~1/` for its checks of
// the chapters, and a record calls for one run on a tree.
const runsOf = record => (existsSync(checksDir) ? readdirSync(checksDir) : [])
  .map(name => new RegExp(`^${record}~(\\d+)${records === null ? '' : '\\.md'}$`).exec(name)).filter(Boolean)
  .map(match => ({ number: Number(match[1]), name: match[0] }));
const nextOf = record => `${record}~${Math.max(0, ...runsOf(record).map(({ number }) => number)) + 1}`;
const readThisTree = (record, name) => {
  const report = records === null ? readdirSync(join(checksDir, name)).find(file => file !== 'reading.md') : name;
  return report !== undefined && readFileSync(join(checksDir, records === null ? join(name, report) : report), 'utf8').includes(`> Tree \`${tree}\``);
};
for (const record of records ?? [calledFor]) {
  const read = runsOf(record).find(({ name }) => readThisTree(record, name));
  if (read !== undefined) {
    console.error(`${shown(join(checksDir, read.name))} stands: ${record} called for a run on this tree`);
    process.exit(1);
  }
}
const run = records === null ? join(checksDir, nextOf(calledFor)) : checksDir;
const reportOf = new Map((records ?? []).map(record => [record, `${nextOf(record)}.md`]));

// A reader holds the tree as it stands: it reads the files, runs the
// language and lists and searches the files, and the history stays out of
// its reach.
const TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
const ALLOWED = ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)', 'Bash(grep:*)', `Bash(git -C ${repoPath} ls-files:*)`];
const flags = ['-p', '--model', 'opus', '--restricted', '--strict-mcp-config', '--tools', ...TOOLS, '--add-dir', repoPath, '--allowedTools', ...ALLOWED];
const env = withTheLanguageOf(repoRoot, { ...process.env, ...CHILD_ENVIRONMENT });
delete env.FORCE_COLOR;
const prompt = readFileSync(promptPath, 'utf8').replaceAll('{{repo}}', repoPath);
const listed = files => {
  const paths = files.map(file => (records === null ? `docs/spec/${file}` : `docs/journal/${file}.md`));
  return paths.length === 1 ? paths[0] : `${paths.slice(0, -1).join(', ')} and ${paths.at(-1)}`;
};
const minuteOf = at => at.toISOString().slice(11, 16);

// The head of a report: what it is and what called it, the tree it read and
// the baseline that tree stood on, when it ran, and how.
const headOf = (group, started, ended) => [
  records === null
    ? `> A check of the chapters ${group.map(file => `\`${file.slice(0, 5)}\``).join(', ')} for ${calledFor} by a clean Opus answering \`${shown(promptPath)}\`.`
    : `> A critique of the open record ${group[0]} by a clean Opus answering \`${shown(promptPath)}\`.`,
  `> Tree \`${tree}\`, ${onTheBaseline}; run ${date}, ${minuteOf(started)}–${minuteOf(ended)} UTC. A path it names reads as \`git show ${tree}:<path>\`.`,
  `> Run as \`claude -p --model opus\` from an empty directory with \`--restricted\` and \`--strict-mcp-config\`, tools \`${TOOLS.join(' ')}\`, \`qlang\`, \`grep\` and \`git ls-files\` allowed, no CLAUDE.md, memory or MCP server, no \`FORCE_COLOR\`.`
].join('\n');

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

mkdirSync(run, { recursive: true });
console.log(`${groups.length} clean readers ${records === null ? 'check the chapters' : 'critique the records'} of ${tree}`);
const firstStarted = new Date();
const outcomes = await Promise.all(groups.map(group => new Promise(resolve => {
  const codes = records === null ? group.map(file => file.slice(0, 5)).join('-') : group[0];
  const started = new Date();
  const child = spawn('claude', flags, { cwd: mkdtempSync(join(tmpdir(), 'qlang-spec-check-')), env });
  let out = '';
  let err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('close', code => {
    const answer = out.trim();
    if (code !== 0 || answer === '') {
      console.error(`${codes}: the reader ended with ${code}: ${err.trim()}`);
      resolve(false);
      return;
    }
    const ended = new Date();
    const report = join(run, records === null ? `${codes}.md` : reportOf.get(codes));
    writeFileSync(report, `${headOf(group, started, ended)}\n\n${linkedFromTheRun(answer)}\n`);
    if (records !== null) held(codes, report, started, ended);
    console.log(`${codes}: ${shown(report)}${records === null ? '' : `, its reading to stand beside it as ${shown(report).replace(/\.md$/, '~reading.md')}`}`);
    resolve(true);
  });
  child.stdin.end(prompt.replace(records === null ? '{{group}}' : '{{record}}', listed(group)));
})));

if (records === null && outcomes.includes(true)) {
  held(calledFor, run, firstStarted, new Date());
  console.log(`${shown(run)}: its reading stands beside the reports, every finding with its fate`);
}
if (outcomes.includes(false)) process.exitCode = 1;

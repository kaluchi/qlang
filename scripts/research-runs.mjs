// The runs of the research its clean readers make: the check of the
// chapters, the critique of an open record, the outside audit and the
// pentimento audit share the start of a reader, the refusals of a run, the
// number of the next run of a record, the head of a report, the packing of
// what they read into groups and the line under `Runs.` of the record that
// called for the run [QSRVW#readers].

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHILD_ENVIRONMENT, withTheLanguageOf } from './benchmark/child.mjs';
import { baselineOf } from './reconciliation.mjs';
import { JOURNAL, readDecisionRecords, replacedWhole } from './decision-records.mjs';

// runLine({ report, kind, tree, baseline, date, from, to, why }) → the line
// of one run, `report` its path from the root of the repository.
export function runLine({ report, kind, tree, baseline, date, from, to, why = null }) {
  const on = baseline === tree ? 'itself the baseline' : `on the baseline \`${baseline}\``;
  return `- \`${report}\`, ${kind}, on the tree \`${tree}\` ${on}, ${date}, ${from}–${to} UTC${why === null ? '' : `: ${why}`}.`;
}

// holdTheRun(repoRoot, record, line) → writes the line under `Runs.` of the
// record, opening the field where the record holds none.
export function holdTheRun(repoRoot, record, line) {
  const path = join(repoRoot, JOURNAL, `${record}.md`);
  const lines = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  if (lines.includes(line)) return;
  const runsAt = lines.findIndex(text => text.startsWith('Runs.'));
  if (runsAt !== -1) {
    let end = runsAt + 1;
    while (end < lines.length && (lines[end].startsWith('- ') || lines[end].startsWith('  '))) end += 1;
    lines.splice(end, 0, line);
  } else {
    let linksAt = lines.length;
    while (linksAt > 0 && /^\[[^\]]+\]: /.test(lines[linksAt - 1])) linksAt -= 1;
    const at = linksAt < lines.length && lines[linksAt - 1] === '' ? linksAt - 1 : lines.length;
    lines.splice(at, 0, 'Runs. The reports of the research this record called for, each beside its reading:', line);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
}

const git = (repoRoot, ...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
export const minuteOf = at => at.toISOString().slice(11, 16);

// A run is called for by a record in force, which holds the run and carries
// the fates of its findings, and a critique by an open record or a decision
// before its code [QSRVW#audits].
export function refuseNoRecordInForce(repoRoot, record, what) {
  if (record !== null && /^D\d+$/.test(record) && existsSync(join(repoRoot, JOURNAL, `${record}.md`))) return;
  console.error(`${what} is called for by a record in force, which carries its fates: write the record, then run \`--for Dnn\``);
  process.exit(1);
}

// A critique reads an open record, or a record of the language decided
// before its code, every case it names a target and none met [QSRVW#audits].
export function refuseNoRecordToCritique(repoRoot, record) {
  const read = readDecisionRecords(repoRoot).get(record);
  const beforeItsCode = read?.domain === 'language' && read.met.length === 0 && read.targets.length > 0;
  if (read !== undefined && !replacedWhole(read) && (read.open || beforeItsCode)) return;
  console.error(`${record} is neither an open record of the journal nor a decision before its code: a critique reads a question still open, or a decision whose every case is a target`);
  process.exit(1);
}

// treeOfTheRun(repoRoot) → the tree the readers read, `{ tree, baseline,
// date, onTheBaseline }`: a report names the tree it read, so a change no
// commit holds is committed before a run.
export function treeOfTheRun(repoRoot) {
  if (git(repoRoot, 'status', '--porcelain') !== '') {
    console.error('the tree holds changes no commit names: commit them, so the reports name the tree they read');
    process.exit(1);
  }
  const tree = git(repoRoot, 'rev-parse', '--short=8', 'HEAD');
  const baseline = baselineOf(repoRoot);
  return { tree, baseline, date: new Date().toISOString().slice(0, 10), onTheBaseline: baseline === tree ? 'itself the baseline' : `on the baseline \`${baseline}\`` };
}

// stillTheTree(repoRoot, tree) → whether the checkout stands at the tree the
// readers started on, its head and its status as they were: a run another
// session's edits moved under its readers writes no report and no line under
// `Runs.`.
export function stillTheTree(repoRoot, tree) {
  if (git(repoRoot, 'rev-parse', '--short=8', 'HEAD') === tree && git(repoRoot, 'status', '--porcelain') === '') return true;
  console.error(`the checkout moved from ${tree} while the readers read: no report is written, and the run starts again on a tree no session edits`);
  return false;
}

// The runs a record called for are numbered in the order they ran, a report
// `D329~2.md` or a run of several readers `D323~1/`, and a record calls for
// one run on a tree. runsOf(dir, record, form) → its runs, each `{ number,
// name }`; nextRunOf the name of the next; refuseASecondRun stops a run on
// a tree a run of the record read.
export const runsOf = (dir, record, form) => (existsSync(dir) ? readdirSync(dir) : [])
  .map(name => new RegExp(`^${record}~(\\d+)${form === 'run' ? '' : '\\.md'}$`).exec(name)).filter(Boolean)
  .map(match => ({ number: Number(match[1]), name: match[0] }));

export const nextRunOf = (dir, record, form) => `${record}~${Math.max(0, ...runsOf(dir, record, form).map(({ number }) => number)) + 1}`;

export function refuseASecondRun(dir, record, form, tree, shown) {
  const readThisTree = name => {
    const report = form === 'run' ? readdirSync(join(dir, name)).find(file => file !== 'reading.md') : name;
    return report !== undefined && readFileSync(join(dir, form === 'run' ? join(name, report) : report), 'utf8').includes(`> Tree \`${tree}\``);
  };
  const read = runsOf(dir, record, form).find(({ name }) => readThisTree(name));
  if (read === undefined) return;
  console.error(`${shown(join(dir, read.name))} stands: ${record} called for a run on this tree`);
  process.exit(1);
}

// The start of a clean reader: a clean Opus from an empty directory of its
// own, with no instruction file, memory or server, the tree's `qplay` first
// on its path, its tools Read, Grep, Glob and Bash for what its caller
// allows and the commands that only read, which the harness passes unasked,
// and no git command but the listing of the files a caller gives it [QSRVW#readers].
export const READER_TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
export const allowedReading = repoPath => ['Read', 'Grep', 'Glob', 'Bash(qplay:*)', 'Bash(MSYS_NO_PATHCONV=1 qplay:*)', 'Bash(grep:*)', `Bash(git -C ${repoPath} ls-files:*)`];

// The effort a clean reader runs at, `max` unless its run names another of
// the efforts by `--effort`, which `CLAUDE_CODE_EFFORT_LEVEL` sets in the
// environment of its start, where no flag and no settings file overrides it,
// so the effort of the session that starts it reaches no reader [QSRVW#readers].
export const READER_EFFORT = 'max';
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// effortOfTheRun(argv) → the effort `--effort` names, `max` where it names
// none; a level that is none of the efforts stops the run.
export function effortOfTheRun(argv) {
  const at = argv.indexOf('--effort');
  if (at === -1) return READER_EFFORT;
  if (EFFORTS.includes(argv[at + 1])) return argv[at + 1];
  console.error(`--effort names one of ${EFFORTS.slice(0, -1).join(', ')} and ${EFFORTS.at(-1)}: ${argv[at + 1] ?? 'nothing'} is none of them`);
  process.exit(1);
}

// readerEnvironment(env, effort) → the environment a reader starts in: the
// session's, the conversion of paths off, its effort set and no `FORCE_COLOR`.
export function readerEnvironment(env, effort) {
  const started = { ...env, ...CHILD_ENVIRONMENT, CLAUDE_CODE_EFFORT_LEVEL: effort };
  delete started.FORCE_COLOR;
  return started;
}

// headOf({ what, tree, onTheBaseline, date, started, ended, allowed, effort })
// → the head of a report: what it is and what called for it, the tree it read
// and the baseline that tree stood on, when it ran, how, and at what effort.
export const headOf = ({ what, tree, onTheBaseline, date, started, ended, allowed, effort }) => [
  `> ${what}`,
  `> Tree \`${tree}\`, ${onTheBaseline}; run ${date}, ${minuteOf(started)}–${minuteOf(ended)} UTC. A path it names reads as \`git show ${tree}:<path>\`.`,
  `> Run as \`claude -p --model opus\` from an empty directory with \`--restricted\` and \`--strict-mcp-config\`, tools \`${READER_TOOLS.join(' ')}\`, ${allowed} allowed and the commands of Bash that only read, which the harness passes unasked, no CLAUDE.md, memory or MCP server, no \`FORCE_COLOR\`.`,
  `> At the effort \`${effort}\`, set by \`CLAUDE_CODE_EFFORT_LEVEL\` in the environment of its start, which no flag and no settings file overrides.`
].join('\n');

// startReaders(repoRoot, { prompts, allowed, workPrefix, effort }) → the
// answers of clean readers started at once at the effort, one for each prompt
// `{ name, text }`, each `{ name, answer, started, ended }`, an answer null
// where its reader failed.
export async function startReaders(repoRoot, { prompts, allowed, workPrefix, effort }) {
  const repoPath = repoRoot.replaceAll('\\', '/');
  const flags = ['-p', '--model', 'opus', '--restricted', '--strict-mcp-config', '--tools', ...READER_TOOLS, '--add-dir', repoPath, '--allowedTools', ...allowed];
  const env = withTheLanguageOf(repoRoot, readerEnvironment(process.env, effort));
  return await Promise.all(prompts.map(({ name, text }) => new Promise(resolve => {
    const started = new Date();
    const child = spawn('claude', flags, { cwd: mkdtempSync(join(tmpdir(), workPrefix)), env });
    let out = '';
    let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('close', code => {
      const answer = out.trim();
      if (code !== 0 || answer === '') console.error(`${name}: the reader ended with ${code}: ${err.trim()}`);
      resolve({ name, answer: code !== 0 || answer === '' ? null : answer, started, ended: new Date() });
    });
    child.stdin.end(text);
  })));
}

// packByWeight(units, count) → the units, each `{ weight }`, packed in their
// order into at most `count` groups of about one weight.
export function packByWeight(units, count) {
  const total = units.reduce((sum, { weight }) => sum + weight, 0);
  const groups = Array.from({ length: count }, () => []);
  let before = 0;
  for (const unit of units) {
    groups[Math.min(count - 1, Math.floor(((before + unit.weight / 2) * count) / total))].push(unit);
    before += unit.weight;
  }
  return groups.filter(group => group.length > 0);
}

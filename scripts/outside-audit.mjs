// The outside audit [QSWRK#review]: a clean Opus reads the tree at HEAD from a
// directory of its own, with no CLAUDE.md, no memory and no MCP server,
// runs `qlang`, and answers `scripts/outside-audit-prompt.txt`. An audit is
// called for by a record in force, `--for D327`, and named after it,
// numbered in the order the audits of that record ran,
// `outside-audit/D327~1.md`; the report opens with its head, what it is and
// the record that called for it, the tree it read and the baseline that tree
// stood on, when it ran and how, and the record holds the run under `Runs.`,
// why it ran given by `--why`. The session writes its reading beside it,
// `D327~1~reading.md`, the fate of each finding in it, and the audit leaves
// with its record at the move of the baseline unless a text in force cites
// it [QSWRK#baseline].
//
// Usage: node scripts/outside-audit.mjs --for Dnn [--why "…"]

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CHILD_ENVIRONMENT, withTheLanguageOf } from './benchmark/child.mjs';
import { baselineOf } from './baseline-walk.mjs';
import { JOURNAL, RESEARCH } from './decision-records.mjs';
import { holdTheRun, runLine } from './research-runs.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const auditsDir = join(repoRoot, RESEARCH, 'outside-audit');
const promptPath = join(repoRoot, 'scripts', 'outside-audit-prompt.txt');
const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
const shown = path => relative(repoRoot, path).replaceAll('\\', '/');
const valueAfter = flag => {
  const at = process.argv.indexOf(flag);
  return at === -1 || at + 1 >= process.argv.length ? null : process.argv[at + 1];
};
const calledFor = valueAfter('--for');
const why = valueAfter('--why');

if (calledFor === null || !/^D\d+$/.test(calledFor) || !existsSync(join(repoRoot, JOURNAL, `${calledFor}.md`))) {
  console.error('an outside audit is called for by a record in force, which holds its run: run `--for Dnn`');
  process.exit(1);
}

// The report names the tree it read, so a change no commit holds is
// committed before the audit runs.
if (git('status', '--porcelain') !== '') {
  console.error('the tree holds changes no commit names: commit them, so the report names the tree it read');
  process.exit(1);
}
const tree = git('rev-parse', '--short=8', 'HEAD');
const date = new Date().toISOString().slice(0, 10);
const baseline = baselineOf(repoRoot);
const onTheBaseline = baseline === tree ? 'itself the baseline' : `on the baseline \`${baseline}\``;

// The audits a record called for are numbered in the order they ran, and a
// record calls for one audit on a tree.
mkdirSync(auditsDir, { recursive: true });
const audits = readdirSync(auditsDir).map(name => new RegExp(`^${calledFor}~(\\d+)\\.md$`).exec(name)).filter(Boolean);
const read = audits.find(([name]) => readFileSync(join(auditsDir, name), 'utf8').includes(`> Tree \`${tree}\``));
if (read !== undefined) {
  console.error(`${shown(join(auditsDir, read[0]))} stands: ${calledFor} called for an audit of this tree`);
  process.exit(1);
}
const report = join(auditsDir, `${calledFor}~${Math.max(0, ...audits.map(match => Number(match[1]))) + 1}.md`);

// The reader holds the tree as it stands, so it reads the files and runs
// the language, and the history stays out of its reach.
const TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
const ALLOWED = ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)'];
const flags = ['-p', '--model', 'opus', '--restricted', '--strict-mcp-config', '--tools', ...TOOLS, '--add-dir', repoPath, '--allowedTools', ...ALLOWED];
const env = withTheLanguageOf(repoRoot, { ...process.env, ...CHILD_ENVIRONMENT });
delete env.FORCE_COLOR;

const workDir = mkdtempSync(join(tmpdir(), 'qlang-outside-audit-'));
const started = new Date();
console.log(`a clean Opus reads ${tree} from ${workDir}`);
const { code, answer, failure } = await new Promise(resolve => {
  const child = spawn('claude', flags, { cwd: workDir, env });
  let out = '';
  let err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('close', exitCode => resolve({ code: exitCode, answer: out.trim(), failure: err.trim() }));
  child.stdin.end(readFileSync(promptPath, 'utf8').replaceAll('{{repo}}', repoPath));
});
if (code !== 0 || answer === '') {
  console.error(`the audit ended with ${code}: ${failure}`);
  process.exit(1);
}

// The head of the report: what it is and what called it, the tree it read and
// the baseline that tree stood on, when it ran, and how.
const minuteOf = at => at.toISOString().slice(11, 16);
const ended = new Date();
const header = [
  `> An outside audit of qlang for ${calledFor} by a clean Opus answering \`${shown(promptPath)}\`.`,
  `> Tree \`${tree}\`, ${onTheBaseline}; run ${date}, ${minuteOf(started)}–${minuteOf(ended)} UTC. A path it names reads as \`git show ${tree}:<path>\`.`,
  `> Run as \`claude -p --model opus\` from an empty directory with \`--restricted\` and \`--strict-mcp-config\`, tools \`${TOOLS.join(' ')}\`, \`qlang\` allowed, no CLAUDE.md, memory or MCP server, no \`FORCE_COLOR\`.`
].join('\n');
writeFileSync(report, `${header}\n\n${answer}\n`);
holdTheRun(repoRoot, calledFor, runLine({
  report: shown(report), kind: 'an outside audit of the tree by a clean reader with no instructions',
  tree, baseline, date, from: minuteOf(started), to: minuteOf(ended), why
}));

console.log(`${shown(report)}: its reading to stand beside it as ${shown(report).replace(/\.md$/, '~reading.md')}, every finding with its fate`);

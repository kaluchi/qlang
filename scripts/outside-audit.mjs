// The outside audit [QSWRK#review]: a clean Opus reads the tree at HEAD from a
// directory of its own, with no CLAUDE.md, no memory and no MCP server,
// runs `qlang`, and answers `scripts/outside-audit-prompt.txt`; its report
// is written into the journal as `<date>-<tree>.md` under a line that says
// how it was made, and the session writes its reading beside it, the fate
// of each finding in it; no record calls an audit for, the landing of a
// branch does, and an audit stays while a text in force cites it, the
// records that took its findings among them [QSWRK#baseline].
//
// Usage: node scripts/outside-audit.mjs

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CHILD_ENVIRONMENT } from './benchmark/child.mjs';
import { baselineOf } from './baseline-walk.mjs';
import { RESEARCH } from './decision-records.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const auditsDir = join(repoRoot, RESEARCH, 'outside-audit');
const promptPath = join(repoRoot, 'scripts', 'outside-audit-prompt.txt');
const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
const shown = path => relative(repoRoot, path).replaceAll('\\', '/');

// The report names the tree it read, so a change no commit holds is
// committed before the audit runs.
if (git('status', '--porcelain') !== '') {
  console.error('the tree holds changes no commit names: commit them, so the report names the tree it read');
  process.exit(1);
}
const tree = git('rev-parse', '--short=8', 'HEAD');
const date = new Date().toISOString().slice(0, 10);
const report = join(auditsDir, `${date}-${tree}.md`);
if (existsSync(report)) {
  console.error(`${shown(report)} stands: this tree was audited on this day`);
  process.exit(1);
}

// The reader holds the tree as it stands, so it reads the files and runs
// the language, and the history stays out of its reach.
const TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
const ALLOWED = ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)'];
const flags = ['-p', '--model', 'opus', '--restricted', '--strict-mcp-config', '--tools', ...TOOLS, '--add-dir', repoPath, '--allowedTools', ...ALLOWED];
const env = { ...process.env, ...CHILD_ENVIRONMENT };
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
  child.stdin.end(readFileSync(promptPath, 'utf8'));
});
if (code !== 0 || answer === '') {
  console.error(`the audit ended with ${code}: ${failure}`);
  process.exit(1);
}

const minuteOf = at => at.toISOString().slice(11, 16);
// The head of the report: what it is and what called it, the tree it read and
// the baseline that tree stood on, when it ran, and how.
const baseline = baselineOf(repoRoot);
const header = [
  '> An outside audit of qlang, which the landing of a branch called for, by a clean Opus answering `scripts/outside-audit-prompt.txt`.',
  `> Tree \`${tree}\`, ${baseline === tree ? 'itself the baseline' : `on the baseline \`${baseline}\``}; run ${date}, ${minuteOf(started)}–${minuteOf(new Date())} UTC. A path it names reads as \`git show ${tree}:<path>\`.`,
  `> Run as \`claude -p --model opus\` from an empty directory with \`--restricted\` and \`--strict-mcp-config\`, tools \`${TOOLS.join(' ')}\`, \`qlang\` allowed, no CLAUDE.md, memory or MCP server, no \`FORCE_COLOR\`.`
].join('\n');
writeFileSync(report, `${header}\n\n${answer}\n`);

console.log(`${shown(report)}: its reading stands beside it, every finding with its fate`);

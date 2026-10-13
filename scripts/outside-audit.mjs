// The outside audit [D277]: a clean Opus reads the tree at HEAD from a
// directory of its own, with no CLAUDE.md, no memory and no MCP server,
// runs `qlang`, and answers the prompt kept beside the audits; its report
// is written there as `<date>-<tree>.md` under a line that says how it was
// made, and the session writes its reading beside it.
//
// Usage: node scripts/outside-audit.mjs

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CHILD_ENVIRONMENT } from './benchmark/child.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const auditsDir = join(repoRoot, 'docs', 'research', 'outside-audit');
const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();

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
  console.error(`${relative(repoRoot, report)} stands: this tree was audited on this day`);
  process.exit(1);
}

const TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
const ALLOWED = ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)', `Bash(git -C ${repoPath} log:*)`];
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
  child.stdin.end(readFileSync(join(auditsDir, 'prompt.txt'), 'utf8'));
});
if (code !== 0 || answer === '') {
  console.error(`the audit ended with ${code}: ${failure}`);
  process.exit(1);
}

const minuteOf = at => at.toISOString().slice(11, 16);
const header = `<!-- An outside audit of qlang by a clean Opus: \`claude -p --model opus\`, started from an empty directory with \`--restricted\` and \`--strict-mcp-config\`, its tools named by \`--tools ${TOOLS.join(' ')}\`, the tree let in by \`--add-dir ${repoPath}\` and reading and \`qlang\` allowed by \`--allowedTools\`, no CLAUDE.md, no memory and no MCP server, without the \`FORCE_COLOR\` of the session, reading the tree at ${tree} and running \`qlang\`, on ${date} from ${minuteOf(started)} to ${minuteOf(new Date())} UTC. Its prompt is prompt.txt beside this file. -->`;
writeFileSync(report, `${header}\n\n${answer}\n`);
console.log(`${relative(repoRoot, report)}: its reading stands beside it, and the fate of each finding in the README there`);

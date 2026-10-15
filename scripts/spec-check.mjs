// The check of the chapters [QSWRK#review]: clean readers, each a clean Opus started
// from a directory of its own as the outside audit is, with no CLAUDE.md, no
// memory and no MCP server and the history out of its reach, read the
// specification whole and then check a group of its chapters against their
// cases, the pages of the catalog and the implementation, answering
// `scripts/spec-check-prompt.txt`. They run at once; each report is written
// into the journal under the run, `<date>-<tree>/<codes>.md`, beneath a line
// that says how it was made, the series keeping its two latest runs, and
// the session writes its reading beside them, `reading.md`, the fate of
// each finding in it.
//
// Usage: node scripts/spec-check.mjs [--groups N] [--dry]
// `--dry` prints the groups and runs no reader.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CHILD_ENVIRONMENT } from './benchmark/child.mjs';
import { RESEARCH } from './decision-records.mjs';

const repoRoot = join(import.meta.dirname, '..');
const repoPath = repoRoot.replaceAll('\\', '/');
const checksDir = join(repoRoot, RESEARCH, 'spec-check');
const promptPath = join(repoRoot, 'scripts', 'spec-check-prompt.txt');
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
const groups = [...packed.filter(group => group.length > 0), ...chapters.filter(file => file.startsWith('QSWRK')).map(file => [file])];
if (process.argv.includes('--dry')) {
  for (const group of groups) console.log(group.join(' '));
  process.exit(0);
}

// The reports name the tree they read, so a change no commit holds is
// committed before the check runs.
if (git('status', '--porcelain') !== '') {
  console.error('the tree holds changes no commit names: commit them, so the reports name the tree they read');
  process.exit(1);
}
const tree = git('rev-parse', '--short=8', 'HEAD');
const date = new Date().toISOString().slice(0, 10);
const run = join(checksDir, `${date}-${tree}`);
if (existsSync(run)) {
  console.error(`${shown(run)} stands: this tree was checked on this day`);
  process.exit(1);
}

// A reader holds the tree as it stands: it reads the files, runs the
// language and lists and searches the files, and the history stays out of
// its reach.
const TOOLS = ['Read', 'Grep', 'Glob', 'Bash'];
const ALLOWED = ['Read', 'Grep', 'Glob', 'Bash(qlang:*)', 'Bash(MSYS_NO_PATHCONV=1 qlang:*)', 'Bash(grep:*)', 'Bash(git ls-files:*)'];
const flags = ['-p', '--model', 'opus', '--restricted', '--strict-mcp-config', '--tools', ...TOOLS, '--add-dir', repoPath, '--allowedTools', ...ALLOWED];
const env = { ...process.env, ...CHILD_ENVIRONMENT };
delete env.FORCE_COLOR;
const prompt = readFileSync(promptPath, 'utf8');
const listed = files => {
  const paths = files.map(file => `docs/spec/${file}`);
  return paths.length === 1 ? paths[0] : `${paths.slice(0, -1).join(', ')} and ${paths.at(-1)}`;
};
const minuteOf = at => at.toISOString().slice(11, 16);

mkdirSync(run, { recursive: true });
console.log(`${groups.length} clean readers check the chapters of ${tree}`);
const outcomes = await Promise.all(groups.map(group => new Promise(resolve => {
  const codes = group.map(file => file.slice(0, 5)).join('-');
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
    const header = `<!-- A check of the chapters of qlang by a clean Opus: \`claude -p --model opus\`, started from an empty directory with \`--restricted\` and \`--strict-mcp-config\`, its tools named by \`--tools ${TOOLS.join(' ')}\`, the tree let in by \`--add-dir ${repoPath}\` and reading, \`qlang\`, \`grep\` and \`git ls-files\` allowed by \`--allowedTools\`, no CLAUDE.md, no memory and no MCP server, without the \`FORCE_COLOR\` of the session, reading the tree at ${tree} and checking ${listed(group)}, on ${date} from ${minuteOf(started)} to ${minuteOf(new Date())} UTC. Its prompt is \`scripts/spec-check-prompt.txt\` at ${tree}. -->`;
    writeFileSync(join(run, `${codes}.md`), `${header}\n\n${answer}\n`);
    console.log(`${codes}: ${shown(join(run, `${codes}.md`))}`);
    resolve(true);
  });
  child.stdin.end(prompt.replace('{{group}}', listed(group)));
})));

// The series keeps its two latest runs: an older run goes to the history
// with its reading [QSWRK#review].
const RUN = /^(\d{4}-\d{2}-\d{2})-([0-9a-f]+)$/;
const byTime = readdirSync(checksDir).filter(name => RUN.test(name))
  .map(name => ({ name, at: Number(git('log', '-1', '--format=%ct', RUN.exec(name)[2])) }))
  .sort((left, right) => left.at - right.at);
for (const { name } of byTime.slice(0, -2)) {
  if (git('ls-files', '--', `${shown(checksDir)}/${name}`) !== '') git('rm', '-r', '-q', '--', `${shown(checksDir)}/${name}`);
  console.log(`${name} goes to the history with its reading`);
}
console.log(`${shown(run)}: its reading stands beside the reports, every finding with its fate`);
if (outcomes.includes(false)) process.exitCode = 1;

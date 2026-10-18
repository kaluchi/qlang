// The screen of the work a shift starts from: the branch
// and how far it stands from master, what the tree leaves uncommitted,
// the walk of the baseline, the targets open and the records being decided,
// the reach of the records in transit [QSWRK#documents], the
// artifacts that name no rule they hold and the records whose scope changed
// since the baseline read them [QSWRK#marks], the stashes, the branches and the
// worktrees a merge leaves [QSWRK#baseline], and the sister project's
// branch against its remote.
//
// Usage: node scripts/desk.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { citationsIn, citingCodeOf, recordsInTransit, walkOfBaseline, RECORDS_A_WALK_TAKES } from './baseline-walk.mjs';
import { marksOfTree, touchedRecords } from './marks.mjs';
import { readText } from './tree-reads.mjs';

const root = join(import.meta.dirname, '..');
const sister = join(root, '..', 'eclipse-jdt-search');
const git = (cwd, ...args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const linesOf = text => (text ?? '').split('\n').filter(Boolean);

const lines = ['desk'];

const branch = git(root, 'branch', '--show-current');
const ahead = git(root, 'rev-list', '--count', 'master..HEAD');
const behind = git(root, 'rev-list', '--count', 'HEAD..master');
const changed = linesOf(git(root, 'status', '--short')).length;
lines.push(`  branch ${branch} · ${ahead} ahead of master, ${behind} behind · ${changed === 0 ? 'the tree clean' : `${changed} paths changed`}`);

const walk = walkOfBaseline(root);
const span = walk.since.length === 0 ? 'none' : walk.since.length === 1 ? walk.since[0] : `${walk.since[0]}–${walk.since[walk.since.length - 1]}`;
lines.push(walk.baseline === undefined ? '  no baseline'
  : `  baseline ${walk.baseline} · ${walk.since.length} of ${RECORDS_A_WALK_TAKES} records since, ${span}`);
if (walk.violations.length === 0) lines.push('  the walk holds');
else {
  lines.push(`  the walk breaks ${walk.violations.length} times [QSWRK#baseline]:`);
  for (const { where, problem } of walk.violations.slice(0, 8)) lines.push(`    ${where}  ${problem}`);
}

const requirements = execFileSync(process.execPath, [join(root, 'scripts', 'requirements.mjs')], { cwd: root, encoding: 'utf8' }).split('\n');
const targets = requirements.filter(line => line.startsWith('target · ')).map(line => `  ${line}`);
lines.push(...(targets.length === 0 ? ['  no target open'] : targets));
const decided = requirements.find(line => line.startsWith('being decided: '));
if (decided !== undefined) lines.push(`  ${decided}`);

// The reach of the records in transit, the tension of the work: a section a
// record overrides, a case it claims and a line of code that cites it speak
// in both voices until the move parts the record, so the merge that lands
// the branch reaches none [QSWRK#documents].
const transit = recordsInTransit(root);
const conformance = join(root, 'core', 'test', 'conformance');
// A line of a case that does not read as JSON claims nothing here; the
// runner refuses it.
const decisionOf = line => {
  try {
    return [JSON.parse(line).decision ?? []].flat();
  } catch {
    return [];
  }
};
const claimed = readdirSync(conformance, { recursive: true }).map(String).filter(name => name.endsWith('.jsonl'))
  .flatMap(name => readText(join(conformance, name)).split(/\r?\n/))
  .filter(line => line.trim() !== '' && !line.trim().startsWith('//'))
  .filter(line => decisionOf(line).some(name => transit.has(name))).length;
const citing = citingCodeOf(root)
  .map(file => new Set(citationsIn(readText(join(root, file))).filter(({ name }) => transit.has(name)).map(({ line }) => line)).size)
  .reduce((sum, count) => sum + count, 0);
lines.push(transit.size === 0 ? '  no record in transit, the tension relaxed'
  : `  reach ${transit.size} records in transit over ${new Set([...transit.values()].flat()).size} sections, ${claimed} cases they claim and ${citing} lines of code that cite them: the move parts them [QSWRK#documents]`);

const { orphans } = marksOfTree(root);
if (orphans.length > 0) lines.push(`  orphans ${orphans.length}, artifacts that name no rule they hold: node scripts/marks.mjs`);
const touched = touchedRecords(root);
const shown = touched.slice(0, 16).map(({ name }) => name).join(' ');
lines.push(touched.length === 0 ? '  no record touched since the baseline read it' : `  touched ${touched.length} records since the baseline read them, ${shown}${touched.length > 16 ? ' …' : ''}: node scripts/marks.mjs --touched`);

const stashes = linesOf(git(root, 'stash', 'list')).length;
if (stashes > 0) lines.push(`  stashes ${stashes}`);
// What a merge leaves behind it, which the move of the baseline clears
// [QSWRK#baseline]: the branches beside master and this one, and the worktrees.
const branches = linesOf(git(root, 'branch', '--format=%(refname:short)')).filter(name => name !== 'master' && name !== branch);
if (branches.length > 0) lines.push(`  branches besides master and this one: ${branches.join(' ')}`);
const worktrees = linesOf(git(root, 'worktree', 'list', '--porcelain')).filter(line => line.startsWith('worktree ')).length - 1;
if (worktrees > 0) lines.push(`  worktrees ${worktrees} besides the checkout: git worktree list`);

if (existsSync(sister)) {
  const sisterBranch = git(sister, 'branch', '--show-current');
  const sisterAhead = git(sister, 'rev-list', '--count', '@{u}..HEAD');
  const sisterChanged = linesOf(git(sister, 'status', '--short')).length;
  lines.push(`  sister ${sisterBranch} · ${sisterAhead ?? 'no remote'} ahead of its remote · ${sisterChanged === 0 ? 'the tree clean' : `${sisterChanged} paths changed`}`);
}

console.log(lines.join('\n'));

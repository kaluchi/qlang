// The screen of the work a shift starts from [QSWRK#baseline], [QSWRK#marks]: the branch
// and how far it stands from master, what the tree leaves uncommitted,
// the walk of the baseline, the targets open and the records being decided, the
// artifacts that name no decision and the records whose scope changed
// since they were described [QSWRK#marks], the stashes, the branches and the
// worktrees a merge leaves [QSWRK#baseline], and the sister project's
// branch against its remote.
//
// Usage: node scripts/desk.mjs

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { walkOfBaseline, RECORDS_A_WALK_TAKES } from './baseline-walk.mjs';
import { marksOfTree, touchedRecords } from './marks.mjs';

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
lines.push(`  baseline ${walk.baseline} · ${walk.since.length} of ${RECORDS_A_WALK_TAKES} records since, ${span}`);
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

const { orphans } = marksOfTree(root);
if (orphans.length > 0) lines.push(`  orphans ${orphans.length}, artifacts that name no decision: node scripts/marks.mjs`);
const touched = touchedRecords(root);
const shown = touched.slice(0, 16).map(({ name }) => name).join(' ');
lines.push(touched.length === 0 ? '  no record touched since the baseline read it' : `  touched ${touched.length} records since the baseline read them, ${shown}${touched.length > 16 ? ' …' : ''}: node scripts/marks.mjs --touched`);
// The debt shows while the baseline is older than the marks: the records
// no move read again before the marks were set, read again once [QSWRK#marks].
const marksSince = linesOf(git(root, 'log', '--diff-filter=A', '--format=%H', '--', 'scripts/marks.mjs')).at(-1);
if (marksSince !== undefined && git(root, 'merge-base', '--is-ancestor', walk.baseline, marksSince) !== null) {
  lines.push(`  debt ${touchedRecords(root, { debt: true }).length} records touched since they were described, which the first move after the marks reads again: node scripts/marks.mjs --touched --debt`);
}

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

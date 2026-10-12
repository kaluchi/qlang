// The screen of the work a shift starts from [D226], [D227]: the branch
// and how far it stands from master, what the tree leaves uncommitted,
// the walk of the audit's baseline, the targets the route holds open, the
// stashes, and the sister project's branch against its remote.
//
// Usage: node scripts/desk.mjs

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { walkOfBaseline, RECORDS_A_WALK_TAKES } from './baseline-walk.mjs';

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
lines.push(`  baseline ${walk.baseline} · ${walk.since.length} of ${RECORDS_A_WALK_TAKES} records since, ${span} · ${walk.partialNow} lines replace in part, ${walk.partialThen} at the baseline`);
if (walk.violations.length === 0) lines.push('  the walk holds');
else {
  lines.push(`  the walk breaks ${walk.violations.length} times [D226]:`);
  for (const { where, problem } of walk.violations.slice(0, 8)) lines.push(`    ${where}  ${problem}`);
}

const requirements = execFileSync(process.execPath, [join(root, 'scripts', 'requirements.mjs')], { cwd: root, encoding: 'utf8' });
const open = [];
for (const line of requirements.split('\n')) {
  if (/^(carried out|being decided|replaced|held by|rules of work|principles):/.test(line)) break;
  if (line.trim() !== '') open.push(`  ${line}`);
}
lines.push(...(open.length === 0 ? ['  no target open'] : open));

const stashes = linesOf(git(root, 'stash', 'list')).length;
if (stashes > 0) lines.push(`  stashes ${stashes}`);

if (existsSync(sister)) {
  const sisterBranch = git(sister, 'branch', '--show-current');
  const sisterAhead = git(sister, 'rev-list', '--count', '@{u}..HEAD');
  const sisterChanged = linesOf(git(sister, 'status', '--short')).length;
  lines.push(`  sister ${sisterBranch} · ${sisterAhead ?? 'no remote'} ahead of its remote · ${sisterChanged === 0 ? 'the tree clean' : `${sisterChanged} paths changed`}`);
}

console.log(lines.join('\n'));

// Drops documents of the research that nothing in force cites, and gives the
// members of each series past its two latest to the history, at the move of
// the baseline, the one cleaning of the work of a branch [QSWRK#baseline]:
// each leaves the tree, which git keeps, a record replaced reading it at the
// commit the record left at; and the lines of the fates a document holds
// that say open are printed, for the author to carry into an open record of
// their axis. A document or a member something in force cites is refused.
//
// Usage: node scripts/drop-documents.mjs <path>...   (no path: the uncited and the series past their two latest)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isReadme, seriesPastTheirTwoLatest, textsInForce, unitOf, uncitedDocuments } from './baseline-walk.mjs';
import { JOURNAL } from './decision-records.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const named = process.argv.length > 2 ? process.argv.slice(2).map(path => path.replaceAll('\\', '/')) : null;
const paths = named ?? uncitedDocuments(repoRoot);
const older = named === null ? seriesPastTheirTwoLatest(repoRoot).flatMap(series => series.older) : [];
if (paths.length === 0 && older.length === 0) { console.log('every document of the research is cited by something in force, and every series holds its two latest'); process.exit(0); }
const texts = textsInForce(repoRoot);
const citersOf = unit => texts.filter(({ text }) => text.includes(unit)).map(({ path }) => path);
for (const path of paths) {
  const citing = citersOf(unitOf(path));
  if (citing.length > 0) { console.error(`${path} is cited by ${citing.join(', ')} [QSWRK#baseline]`); process.exit(2); }
  if (isReadme(path) || !existsSync(join(repoRoot, path))) { console.error(`${path} is no document to drop`); process.exit(2); }
}
// A member of a series is cited as the journal writes it, a run's folder or
// a report's name from the root of the journal.
for (const { member } of older) {
  const citing = citersOf(member.startsWith(`${JOURNAL}/`) ? member.slice(JOURNAL.length + 1) : member);
  if (citing.length > 0) { console.error(`${member} is cited by ${citing.join(', ')} [QSWRK#baseline]`); process.exit(2); }
}
const commit = git('rev-parse', '--short=8', 'HEAD');

for (const path of [...paths, ...older.flatMap(member => member.paths)]) {
  const open = path.endsWith('.md')
    ? readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/).filter(line => /\b[Oo]pen[.,;]/.test(line))
    : [];
  if (open.length > 0) console.log(`  ${path}, open at ${commit}, to carry into an open record of their axis:\n${open.map(line => `    ${line}`).join('\n')}`);
  git('rm', '-q', '--', path);
  console.log(`dropped ${path}`);
}

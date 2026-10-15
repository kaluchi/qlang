// Drops documents of the research that nothing in force cites [QSWRK#baseline]:
// each leaves the tree, which git keeps, a record replaced reading it at the
// commit the record left at; and the lines of the fates a document holds
// that say open are printed, for the author to carry into an open record of
// their axis. A document something in force cites is refused.
//
// Usage: node scripts/drop-documents.mjs <path>...   (no path: the uncited)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isReadme, textsInForce, unitOf, uncitedDocuments } from './baseline-walk.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const paths = process.argv.length > 2 ? process.argv.slice(2).map(path => path.replaceAll('\\', '/')) : uncitedDocuments(repoRoot);
if (paths.length === 0) { console.log('every document of the research is cited by something in force'); process.exit(0); }
const texts = textsInForce(repoRoot);
for (const path of paths) {
  const citing = texts.filter(({ text }) => text.includes(unitOf(path))).map(({ path: citer }) => citer);
  if (citing.length > 0) { console.error(`${path} is cited by ${citing.join(', ')} [QSWRK#baseline]`); process.exit(2); }
  if (isReadme(path) || !existsSync(join(repoRoot, path))) { console.error(`${path} is no document to drop`); process.exit(2); }
}
const commit = git('rev-parse', '--short=8', 'HEAD');

for (const path of paths) {
  const open = path.endsWith('.md')
    ? readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/).filter(line => /\b[Oo]pen[.,;]/.test(line))
    : [];
  if (open.length > 0) console.log(`  ${path}, open at ${commit}, to carry into an open record of their axis:\n${open.map(line => `    ${line}`).join('\n')}`);
  git('rm', '-q', '--', path);
  console.log(`dropped ${path}`);
}

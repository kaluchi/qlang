// Drops documents of the research that nothing in force cites [D282]:
// each leaves the tree, which git keeps, with its part of the ledger of
// its folder, a record replaced reading it at the commit the record left
// at; and the lines of its part of the ledger that say open are printed,
// for the author to carry under the document's name and the commit that
// last held it. A document something in force cites is refused.
//
// Usage: node scripts/drop-documents.mjs <path>...   (no path: the uncited)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { isReadme, textsInForce, unitOf, uncitedDocuments } from './baseline-walk.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const paths = process.argv.length > 2 ? process.argv.slice(2).map(path => path.replaceAll('\\', '/')) : uncitedDocuments(repoRoot);
if (paths.length === 0) { console.log('every document of the research is cited by something in force'); process.exit(0); }
const texts = textsInForce(repoRoot);
for (const path of paths) {
  const citing = texts.filter(({ text }) => text.includes(unitOf(path))).map(({ path: citer }) => citer);
  if (citing.length > 0) { console.error(`${path} is cited by ${citing.join(', ')} [D282]`); process.exit(2); }
  if (isReadme(path) || !existsSync(join(repoRoot, path))) { console.error(`${path} is no document to drop`); process.exit(2); }
}
const commit = git('rev-parse', '--short=8', 'HEAD');

const rewrite = (path, change) => {
  const raw = readFileSync(join(repoRoot, path), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.split('\r\n').join('\n');
  const written = change(text);
  if (written !== text) writeFileSync(join(repoRoot, path), written.split('\n').join(eol));
  return written !== text;
};

for (const path of paths) {
  const name = posix.basename(path);
  // The ledger of the folder: the part that opens with the document's
  // link, from its header or its link to the next of either.
  const ledger = `${posix.dirname(path)}/README.md`;
  if (existsSync(join(repoRoot, ledger))) {
    rewrite(ledger, text => {
      const lines = text.split('\n');
      const link = lines.findIndex(line => line.startsWith(`[${name}](`));
      if (link === -1) return text;
      const from = /^## /.test(lines[link - 2] ?? '') ? link - 2 : link;
      let to = link + 1;
      while (to < lines.length && !/^## /.test(lines[to]) && !/^\[\d{4}-\d{2}-\d{2}/.test(lines[to])) to += 1;
      const open = lines.slice(from, to).filter(line => /\bopen\b/i.test(line));
      if (open.length > 0) console.log(`  ${ledger}, open under ${name}, to carry at ${commit}:\n${open.map(line => `    ${line}`).join('\n')}`);
      lines.splice(from, to - from);
      return lines.join('\n').replace(/\n{3,}/g, '\n\n');
    });
  }
  git('rm', '-q', '--', path);
  console.log(`dropped ${path}`);
}

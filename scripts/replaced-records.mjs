// The records replaced whole leave the root of the records for
// `docs/decisions/replaced/`, once, and every link of a document to a
// record is written again from the document's place to the record's
// [D237]. Run where a record gains its line `Replaced by` or `Merged
// into`; a record moved once is never moved again.
//
// Usage: node scripts/replaced-records.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const recordsDir = join(repoRoot, 'docs', 'decisions');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

const replacedWhole = text => /^(Replaced by|Merged into) /m.test(text);
const moving = readdirSync(recordsDir)
  .filter(name => /^[DE]\d+\.md$/.test(name) && replacedWhole(readFileSync(join(recordsDir, name), 'utf8')));
mkdirSync(join(recordsDir, 'replaced'), { recursive: true });
for (const name of moving) git('mv', `docs/decisions/${name}`, `docs/decisions/replaced/${name}`);

// A record under `replaced/` never moves again, so a link to the root's
// place of it, from a move this run or a merge that wrote the link
// before it, points there.
const movedTo = new Map(readdirSync(join(recordsDir, 'replaced')).filter(name => /^[DE]\d+\.md$/.test(name))
  .map(name => [`docs/decisions/${name}`, `docs/decisions/replaced/${name}`]));
const movedFrom = new Map(moving.map(name => [`docs/decisions/replaced/${name}`, `docs/decisions/${name}`]));

// A link of markdown, its definition `[D44]: D44.md` or its inline form
// `(D44.md)`, whose target is a file of markdown.
const LINK = /(\]:[ \t]*|\]\()([^)\s]+\.md)(?=[)\s]|$)/gm;
let relinked = 0;
for (const path of git('ls-files', '*.md').split('\n').filter(Boolean)) {
  const wasAt = movedFrom.get(path) ?? path;
  const text = readFileSync(join(repoRoot, path), 'utf8');
  const written = text.replace(LINK, (whole, lead, target) => {
    if (/^[a-z]+:/i.test(target) || target.startsWith('/')) return whole;
    const pointedThen = posix.normalize(posix.join(posix.dirname(wasAt), target));
    const pointedNow = movedTo.get(pointedThen) ?? pointedThen;
    if (pointedNow === pointedThen && wasAt === path) return whole;
    return `${lead}${posix.relative(posix.dirname(path), pointedNow)}`;
  });
  if (written === text) continue;
  writeFileSync(join(repoRoot, path), written);
  relinked++;
}
console.log(`replaced: ${moving.length === 0 ? 'no record in the root is replaced whole' : `${moving.map(name => name.slice(0, -3)).join(' ')} moved`}; links written again in ${relinked} documents`);

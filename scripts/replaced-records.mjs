// The records replaced whole leave the root of the records for
// `docs/journal/replaced/`, once, and every link of a document to a
// record is written again from the document's folder to the record's
// [QSWRK#journal], each naming the commit it left at. Run where a record
// gains its line `Replaced by` or `Merged into`; a record moved once is
// never moved again.
//
// Usage: node scripts/replaced-records.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { FATES_OUT_OF_FORCE, JOURNAL, REPLACED, lineOfFate } from './decision-records.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const recordsDir = join(repoRoot, JOURNAL);
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const replacedWhole = text => lineOfFate(FATES_OUT_OF_FORCE, 'm').test(text);
const moving = readdirSync(recordsDir)
  .filter(name => /^D\d+\.md$/.test(name) && replacedWhole(readFileSync(join(recordsDir, name), 'utf8')));
mkdirSync(join(recordsDir, 'replaced'), { recursive: true });
// A record leaving names, under its title, the commit its text was last
// true of, `Left at`, and each path of the tree it names in backticks
// reads as `git show` at that commit, so nothing it names leads into
// today's tree [QSWRK#journal].
const head = git('rev-parse', '--short=8', 'HEAD').trim();
const TREE_PATH = /`((?:core|cli|lsp|vscode|site|scripts|docs|\.claude|\.github)\/[A-Za-z0-9_./-]+)`/g;
const atHead = path => {
  try {
    git('cat-file', '-e', `${head}:${path.replace(/\/$/, '')}`);
    return true;
  } catch {
    return false;
  }
};
for (const name of moving) {
  const path = join(recordsDir, name);
  const raw = readFileSync(path, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split('\r\n').join('\n').replace(/\n+$/, '').split('\n');
  if (!lines.some(line => line.startsWith('Left at '))) {
    lines.splice(1, 0, '', `Left at ${head}, the tree this text was last true of: a path, a case or a`, `probe it names reads there, \`git show ${head}:<path>\`, not in today's.`);
  }
  const pinned = lines.join('\n').replace(TREE_PATH, (whole, named) => (named.startsWith(`${JOURNAL}/`) || !atHead(named) ? whole : `\`git show ${head}:${named}\``));
  writeFileSync(path, `${pinned}\n`.split('\n').join(eol));
  git('mv', `${JOURNAL}/${name}`, `${REPLACED}/${name}`);
}

// A record under `replaced/` never moves again, so a link to where it
// stood in the root, from a move this run or a merge that wrote the link
// before it, points there.
const movedTo = new Map(readdirSync(join(recordsDir, 'replaced')).filter(name => /^[DE]\d+\.md$/.test(name))
  .map(name => [`${JOURNAL}/${name}`, `${REPLACED}/${name}`]));
const movedFrom = new Map(moving.map(name => [`${REPLACED}/${name}`, `${JOURNAL}/${name}`]));

// A link of markdown, its definition `[Dnn]: Dnn.md` or its inline form
// `(Dnn.md)`, whose target is a file of markdown, an anchor after it
// among them, `(AIM.md#principles)`, written again once from the folder
// the document stood in.
const LINK = /(\]:[ \t]*|\]\()([^)\s#]+\.md)(#[^)\s]*)?(?=[)\s]|$)/gm;
let relinked = 0;
for (const path of git('ls-files', '*.md').split('\n').filter(Boolean)) {
  const wasAt = movedFrom.get(path) ?? path;
  const text = readFileSync(join(repoRoot, path), 'utf8');
  const written = text.replace(LINK, (whole, lead, target, anchor = '') => {
    if (/^[a-z]+:/i.test(target) || target.startsWith('/')) return whole;
    const pointedThen = posix.normalize(posix.join(posix.dirname(wasAt), target));
    const pointedNow = movedTo.get(pointedThen) ?? pointedThen;
    if (pointedNow === pointedThen && wasAt === path) return whole;
    return `${lead}${posix.relative(posix.dirname(path), pointedNow)}${anchor}`;
  });
  if (written === text) continue;
  writeFileSync(join(repoRoot, path), written);
  relinked++;
}
console.log(`replaced: ${moving.length === 0 ? 'no record in the root is replaced whole' : `${moving.map(name => name.slice(0, -3)).join(' ')} moved`}; links written again in ${relinked} documents`);

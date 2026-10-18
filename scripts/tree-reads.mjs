// The texts the scripts of the work read, each read once in a run: a file of
// the checkout kept while its size and its time of change stand, so a script
// that writes a file reads what it wrote, and the tree of a commit, which never
// changes, its paths listed by one call of git and its files read by one batch
// [QSWRK#baseline].

import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const READ = new Map();

// readText(path) → the text of a file of the checkout.
export function readText(path) {
  const { size, mtimeMs } = statSync(path);
  const kept = READ.get(path);
  if (kept !== undefined && kept.size === size && kept.mtimeMs === mtimeMs) return kept.text;
  const text = readFileSync(path, 'utf8');
  READ.set(path, { size, mtimeMs, text });
  return text;
}

const git = (repoRoot, args, input) => execFileSync('git', args, { cwd: repoRoot, input, maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'ignore'] });

const TREES = new Map();

// treeAt(repoRoot, commit) → the tree of a commit: `paths` its files,
// `holds(path)` whether it holds that file or a folder of that path, and
// `textsOf(paths)` the texts of those of its files it holds, by path.
export function treeAt(repoRoot, commit) {
  const key = `${repoRoot}\0${commit}`;
  if (TREES.has(key)) return TREES.get(key);
  const paths = git(repoRoot, ['ls-tree', '-r', '--name-only', commit]).toString('utf8').split('\n').filter(Boolean);
  const files = new Set(paths);
  const folders = new Set(paths.flatMap(path => path.split('/').slice(0, -1).map((_, at, parts) => parts.slice(0, at + 1).join('/'))));
  const texts = new Map();
  const tree = {
    paths,
    holds: path => files.has(path) || folders.has(path.replace(/\/$/, '')),
    textsOf(wanted) {
      const missing = [...new Set(wanted)].filter(path => files.has(path) && !texts.has(path));
      if (missing.length > 0) readBatch(repoRoot, commit, missing).forEach((text, path) => texts.set(path, text));
      return new Map(wanted.filter(path => texts.has(path)).map(path => [path, texts.get(path)]));
    }
  };
  TREES.set(key, tree);
  return tree;
}

// The files of a commit read by one `git cat-file --batch`, each answered as
// its header, `<oid> blob <size>`, and its bytes.
function readBatch(repoRoot, commit, paths) {
  const out = git(repoRoot, ['cat-file', '--batch'], paths.map(path => `${commit}:${path}\n`).join(''));
  const texts = new Map();
  let at = 0;
  for (const path of paths) {
    const end = out.indexOf(0x0a, at);
    const size = Number(out.toString('utf8', at, end).split(' ')[2]);
    texts.set(path, out.toString('utf8', end + 1, end + 1 + size));
    at = end + 1 + size + 1;
  }
  return texts;
}

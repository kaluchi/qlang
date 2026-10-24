// The names a grep finds [QSLEX#grep], [D431]: no two modules of the project
// bear one name, a test file, which the section it stands at names, and a
// configuration of a tool aside by their form; and the false matches of a name
// the core exports, the files that hold it as a word and neither define,
// import nor re-export it, which `node scripts/sensors/vocabulary.mjs
// --exports` prints for every export of `core/src`.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MODULE = /\.(?:mjs|js|qlang|peggy)$/;
const ASIDE_BY_FORM = /\.(?:test|config)\.m?js$/;
const NO_MODULES = /(?:^|\/)(?:gen|dist|node_modules|sets)\//;
// The texts a grep reads: the code, the catalog, the cases and the prose,
// the history of the journal aside.
const TEXT = /\.(?:mjs|js|peggy|qlang|md|astro|jsonl)$/;
const HISTORY = /(?:^|\/)(?:gen|dist|node_modules|sets|screens|replaced|research)\//;

const tracked = repoRoot => execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
const stemOf = path => path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');

// namesSharedByModules(paths) → each name two modules or more bear, `{ name,
// paths }`, in the order of the names.
export function namesSharedByModules(paths) {
  const byName = new Map();
  for (const path of paths.filter(path => MODULE.test(path) && !ASIDE_BY_FORM.test(path) && !NO_MODULES.test(path))) {
    byName.set(stemOf(path), [...(byName.get(stemOf(path)) ?? []), path]);
  }
  return [...byName].filter(([, shared]) => shared.length > 1).map(([name, shared]) => ({ name, paths: shared })).sort((left, right) => left.name.localeCompare(right.name));
}

// namesSharedInTree(repoRoot) → the names the tracked modules share.
export const namesSharedInTree = repoRoot => namesSharedByModules(tracked(repoRoot));

const EXPORTED = /^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm;
const escaped = name => name.replace(/\$/g, '\\$');

// falseMatchesOf(texts) → for each name a module of `core/src` exports, `{
// name, module, users, falseFiles, falseLines }`, the files that define,
// import or re-export it and the files and the matches of it as a word in
// any other, the most false first; `texts` a map of each path to its text.
export function falseMatchesOf(texts) {
  const defined = new Map();
  for (const [path, text] of texts) {
    if (!path.startsWith('core/src/') || !path.endsWith('.mjs')) continue;
    for (const [, name] of text.matchAll(EXPORTED)) if (!defined.has(name)) defined.set(name, path);
  }
  return [...defined].map(([name, module]) => {
    const word = new RegExp(`(?<![\\w$])${escaped(name)}(?![\\w$])`, 'g');
    const taken = new RegExp(`(?:import|export)\\s*\\{[^}]*(?<![\\w$])${escaped(name)}(?![\\w$])[^}]*\\}`);
    let users = 0, falseFiles = 0, falseLines = 0;
    for (const [path, text] of texts) {
      const matches = text.match(word)?.length ?? 0;
      if (matches === 0) continue;
      if (path === module || taken.test(text)) users++;
      else { falseFiles++; falseLines += matches; }
    }
    return { name, module, users, falseFiles, falseLines };
  }).sort((left, right) => right.falseFiles - left.falseFiles || left.name.localeCompare(right.name));
}

// falseMatchesInTree(repoRoot) → the false matches of the exports of the
// core over the texts the tree tracks.
export function falseMatchesInTree(repoRoot) {
  const paths = tracked(repoRoot).filter(path => TEXT.test(path) && !HISTORY.test(path));
  return falseMatchesOf(new Map(paths.map(path => [path, readFileSync(join(repoRoot, path), 'utf8')])));
}

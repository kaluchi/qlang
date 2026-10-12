// The marks the artifacts set on the decisions they exist for [D237]: a
// module, a script and a test file name a record in a comment or a title,
// `[D44]`, a case names it in its `decision`, and the sister project
// names a record of qlang as `(qlang D96)`. A record lists no file; its
// scope is every place that marks it, which this search answers.
//
// Usage:
//   node scripts/marks.mjs                 the artifacts that mark no record, the orphans
//   node scripts/marks.mjs D44             the places that mark a record
//   node scripts/marks.mjs <path>          the records a file marks
//   node scripts/marks.mjs --diff <rev>    the records the files changed since a revision mark
//   node scripts/marks.mjs --sister <dir>  the places of the sister project that mark a record

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });

// An artifact is a source, a script or a test file of a workspace, a
// source of qlang by the comment at its head and a workflow; the data a
// run of the benchmark wrote, its runs and the sets its authors
// generated, marks nothing [D142].
const ARTIFACT = /\.(mjs|js|peggy|qlang)$|^\.github\/workflows\/.*\.ya?ml$/;
const RUN_OUTPUT = /^scripts\/benchmark\/(runs|sets)\//;
const isArtifact = path => ARTIFACT.test(path) && !path.startsWith('docs/') && !RUN_OUTPUT.test(path);
const CASES = /^core\/test\/conformance\/.*\.jsonl$/;

const MARK = /\[((?:[DE]\d+)(?:,\s*[DE]\d+)*)\]/g;
const SISTER_MARK = /\(qlang ((?:D\d+)(?:,\s*D?\d+)*)\)/g;

function marksOfText(text, pattern) {
  const marks = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(pattern)) {
      for (const name of match[1].split(/,\s*/)) marks.push({ name: name.startsWith('D') || name.startsWith('E') ? name : `D${name}`, line: index + 1 });
    }
  });
  return marks;
}

function marksOfCases(text) {
  const marks = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '' || line.trim().startsWith('//')) return;
    for (const name of [JSON.parse(line).decision ?? []].flat()) marks.push({ name, line: index + 1 });
  });
  return marks;
}

// marksOfTree(root) → every mark the tracked files of a checkout set, each
// `{ path, name, line }`, and the artifacts that set none.
export function marksOfTree(root = repoRoot) {
  const marks = [];
  const orphans = [];
  for (const path of git(root, 'ls-files').split('\n').filter(Boolean)) {
    if (CASES.test(path)) { marks.push(...marksOfCases(readFileSync(join(root, path), 'utf8')).map(mark => ({ path, ...mark }))); continue; }
    if (!isArtifact(path)) continue;
    const found = marksOfText(readFileSync(join(root, path), 'utf8'), MARK);
    if (found.length === 0) orphans.push(path);
    marks.push(...found.map(mark => ({ path, ...mark })));
  }
  return { marks, orphans };
}

function marksOfSister(dir) {
  return git(dir, 'ls-files').split('\n').filter(path => /\.(mjs|js|qlang|md)$/.test(path))
    .flatMap(path => marksOfText(readFileSync(join(dir, path), 'utf8'), SISTER_MARK).map(mark => ({ path, ...mark })));
}

const [command, argument] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('marks.mjs')) {
  if (command === '--sister') {
    for (const { path, name, line } of marksOfSister(resolve(argument))) console.log(`${name}\t${path}:${line}`);
  } else if (command === '--diff') {
    const changed = new Set(git(repoRoot, 'diff', '--name-only', argument, '--').split('\n').filter(Boolean));
    const touched = new Map();
    for (const { path, name } of marksOfTree().marks.filter(mark => changed.has(mark.path))) {
      if (!touched.has(name)) touched.set(name, new Set());
      touched.get(name).add(path);
    }
    for (const [name, paths] of [...touched].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) console.log(`${name}\t${[...paths].join(' ')}`);
  } else if (/^[DE]\d+$/.test(command ?? '')) {
    for (const { path, line } of marksOfTree().marks.filter(mark => mark.name === command)) console.log(`${path}:${line}`);
  } else if (command !== undefined && existsSync(resolve(repoRoot, command))) {
    const names = new Set(marksOfTree().marks.filter(mark => mark.path === command.replaceAll('\\', '/')).map(mark => mark.name));
    console.log([...names].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join(' '));
  } else {
    const { orphans } = marksOfTree();
    for (const path of orphans) console.log(path);
    console.log(`marks: ${orphans.length === 0 ? 'every artifact names the decision it exists for' : `${orphans.length} artifacts name no decision`}`);
    process.exitCode = orphans.length === 0 ? 0 : 1;
  }
}

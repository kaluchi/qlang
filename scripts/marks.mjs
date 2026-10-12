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
//   node scripts/marks.mjs --touched       the records whose scope changed since they were described
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

// The data of the benchmark names the decision it measures in the name of
// its file, where no text of its own can bear a mark: a screen,
// `screens/D167.txt`, and a run of a set, `sets/H/runs/D167~blind~haiku~1.json`
// [D142], [D183].
const PATH_MARKS = [
  /^scripts\/benchmark\/screens\/(D\d+)(?:\.[0-9a-f]+)?\.txt$/,
  /^scripts\/benchmark\/sets\/[^/]+\/runs\/(D\d+)~[^/]+\.json$/
];
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
    const byPath = PATH_MARKS.map(pattern => pattern.exec(path)?.[1]).find(Boolean);
    if (byPath !== undefined) { marks.push({ path, name: byPath, line: 1 }); continue; }
    if (CASES.test(path)) { marks.push(...marksOfCases(readFileSync(join(root, path), 'utf8')).map(mark => ({ path, ...mark }))); continue; }
    if (!isArtifact(path)) continue;
    const found = marksOfText(readFileSync(join(root, path), 'utf8'), MARK);
    if (found.length === 0) orphans.push(path);
    marks.push(...found.map(mark => ({ path, ...mark })));
  }
  return { marks, orphans };
}

// The commit each record in force was last described in: the newest that
// changed a line of it beyond a link, a statement of fate and a citation
// a merge or a move wrote anew, which leave its decision as it was.
const LINK_OR_FATE = /^(\[[DE]\d+\]: |(Pruned of what|Replaced by|Merged into|Replaced in part by) )/;
const CITATIONS = /\[[DE]\d+\](?:(?:,\s*|,?\s+and\s+)\[[DE]\d+\])*/g;
const beyondCitations = text => text.replace(CITATIONS, '').replace(/"decision":(\[[^\]]*\]|"[^"]*")/g, '"decision":D').replace(/\s+/g, ' ').trim();
const decisionOf = lines => beyondCitations(lines.filter(line => !LINK_OR_FATE.test(line)).join(' '));

// The sides of each file a diff of `-U0` changes, the lines it removed and
// the lines it added.
function sidesOf(diff, pathOf) {
  const sides = new Map();
  for (const section of diff.split(/^diff --git /m).slice(1)) {
    const path = pathOf(section);
    if (path === undefined) continue;
    const lines = section.split('\n');
    sides.set(path, {
      removed: lines.filter(line => line.startsWith('-') && !line.startsWith('---')).map(line => line.slice(1)),
      added: lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1))
    });
  }
  return sides;
}

// The files among the paths a diff since a commit changed beyond the
// citations of decisions, a mark, its line `The decisions it exists for`
// or a case's `decision`, which leave what a file does as it was.
const MARK_STATEMENT = /The decisions? it exists for: [^.]*\./;
function changedBeyondCitations(root, commit, paths) {
  const changed = new Set();
  const diff = git(root, 'diff', '-U0', '-M', '--no-color', commit, '--', ...paths);
  const beyondMarks = lines => beyondCitations(lines.map(line => line.replace(MARK_STATEMENT, ''))
    .filter(line => !/^\s*(\/\/|#|\*)?\s*$/.test(line)).join(' '));
  for (const [path, { removed, added }] of sidesOf(diff, section => section.match(/^a\/\S+ b\/(\S+)\n/)?.[1])) {
    if (beyondMarks(removed) !== beyondMarks(added)) changed.add(path);
  }
  return changed;
}

function describedIn(root) {
  const inForce = new Set(git(root, 'ls-files', 'docs/decisions').split('\n').map(path => path.match(/^docs\/decisions\/([DE]\d+)\.md$/)?.[1]).filter(Boolean));
  const described = new Map();
  const log = git(root, 'log', '-p', '-M', '--unified=0', '--format=%x00%H', '--', 'docs/decisions');
  for (const entry of log.split('\0').slice(1)) {
    const commit = entry.slice(0, entry.indexOf('\n'));
    for (const [name, { removed, added }] of sidesOf(entry, section => section.match(/^a\/\S+ b\/docs\/decisions\/([DE]\d+)\.md\n/)?.[1])) {
      if (!inForce.has(name) || described.has(name)) continue;
      if (decisionOf(removed) !== decisionOf(added)) described.set(name, commit);
    }
  }
  return described;
}

// touchedRecords(root) → the records in force whose scope the tree changed
// since they were described, each `{ name, commit, files }`, the changes
// the working tree holds among them: what a move of the baseline reads
// again against the new root [D237].
export function touchedRecords(root = repoRoot) {
  const scopes = new Map();
  for (const { path, name } of marksOfTree(root).marks) {
    if (!scopes.has(name)) scopes.set(name, new Set());
    scopes.get(name).add(path);
  }
  const namesOf = new Map();
  for (const [name, commit] of describedIn(root)) {
    if (!scopes.has(name)) continue;
    if (!namesOf.has(commit)) namesOf.set(commit, []);
    namesOf.get(commit).push(name);
  }
  const touched = [];
  for (const [commit, names] of namesOf) {
    const changed = changedBeyondCitations(root, commit, [...new Set(names.flatMap(name => [...scopes.get(name)]))]);
    for (const name of names) {
      const files = [...scopes.get(name)].filter(path => changed.has(path));
      if (files.length > 0) touched.push({ name, commit, files });
    }
  }
  return touched.sort((a, b) => a.name[0].localeCompare(b.name[0]) || Number(a.name.slice(1)) - Number(b.name.slice(1)));
}

function marksOfSister(dir) {
  return git(dir, 'ls-files').split('\n').filter(path => /\.(mjs|js|qlang|md)$/.test(path))
    .flatMap(path => marksOfText(readFileSync(join(dir, path), 'utf8'), SISTER_MARK).map(mark => ({ path, ...mark })));
}

const [command, argument] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('marks.mjs')) {
  if (command === '--touched') {
    const touched = touchedRecords();
    for (const { name, commit, files } of touched) console.log(`${name}\t${commit.slice(0, 8)}\t${files.length}\t${files.join(' ')}`);
    console.log(`touched: ${touched.length} records in force whose scope the tree changed since they were described [D237]`);
  } else if (command === '--sister') {
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
    console.log(`marks: ${orphans.length === 0 ? 'every artifact names the decision it exists for' : `${orphans.length} artifacts name no decision [D237]`}`);
    process.exitCode = orphans.length === 0 ? 0 : 1;
  }
}

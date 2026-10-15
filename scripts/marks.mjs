// The marks the artifacts set on the decisions they exist for [QSWRK#marks]: a
// module, a script and a test file name a record in a comment or a title,
// `[Dnn]`, a case names it in its `decision`, and the sister project
// names a record of qlang as `(qlang Dnn)`. A record lists no file; its
// scope is every place that marks it, which this search answers.
//
// Usage:
//   node scripts/marks.mjs                 the artifacts that mark no record, the orphans
//   node scripts/marks.mjs D44             the places that mark a record
//   node scripts/marks.mjs QSNAM#scope     the places that mark a section
//   node scripts/marks.mjs <path>          the records a file marks
//   node scripts/marks.mjs --diff <rev>    the records the files changed since a revision mark
//   node scripts/marks.mjs --touched       the records whose scope changed since they were read against it
//   node scripts/marks.mjs --touched --debt  the same since they were described, the debt before the marks
//   node scripts/marks.mjs --reread D44 [--debt]  the hunks of the blocks of a record since it was read
//   node scripts/marks.mjs --sister <dir>  the places of the sister project that mark a record

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { baselineOf } from './baseline-walk.mjs';
import { FATE, FIELD_OPENS, LINK_DEFINITION, JOURNAL } from './decision-records.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });

// An artifact is a source, a script or a test file of a workspace, a
// source of qlang by the comment at its head and a workflow; the data a
// run of the benchmark wrote, its runs and the sets its authors
// generated, is none and carries no mark inside it [QSWRK#marks].
const ARTIFACT = /\.(mjs|js|peggy|qlang)$|^\.github\/workflows\/.*\.ya?ml$/;
const RUN_OUTPUT = /^scripts\/benchmark\/(runs|sets)\//;
const isArtifact = path => ARTIFACT.test(path) && !path.startsWith('docs/') && !RUN_OUTPUT.test(path);
const CASES = /^core\/test\/conformance\/.*\.jsonl$/;

// A mark names a record or a section of the specification, `[QSNAM#scope]`
// [QSWRK#marks].
const MARK = /\[((?:[DE]\d+|QS[A-Z]{3}(?:#[a-z][a-z-]*)?)(?:,\s*(?:[DE]\d+|QS[A-Z]{3}(?:#[a-z][a-z-]*)?))*)\]/g;

// The data of the benchmark names the decision it measures in the name of
// its file, where no text of its own can bear a mark: a screen,
// `screens/D270.txt`, and a run of a set, `sets/V/runs/D270~cli~sonnet~1.json`
// [QSWRK#measure].
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
      for (const name of match[1].split(/,\s*/)) marks.push({ name: /^(D|E|QS)/.test(name) ? name : `D${name}`, line: index + 1 });
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

// The blocks a file's marks stand on: a mark covers the lines from the
// comment that holds it to the next comment that holds one, the marks of
// one comment covering one block, and the first block reaches up to the
// head of the file, so every line of an artifact lies under a mark; a case
// covers its own line [QSWRK#marks].
function commentLines(text, path) {
  const lines = text.split(/\r?\n/);
  const isComment = [];
  let inQlangComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (path.endsWith('.qlang')) {
      const opens = /^\|~(?!~)/.test(trimmed);
      isComment.push(inQlangComment || opens);
      if (opens || inQlangComment) inQlangComment = !/~\|\s*$/.test(trimmed);
    } else isComment.push(/^(\/\/|\/\*|\*|#)/.test(trimmed));
  }
  return isComment;
}

function blocksOf(marks, text, path) {
  const isComment = commentLines(text, path);
  const startOf = line => {
    let start = line;
    while (start > 1 && isComment[line - 1] && isComment[start - 2]) start--;
    return start;
  };
  const starts = new Map();
  for (const { name, line } of marks) {
    const start = startOf(line);
    if (!starts.has(start)) starts.set(start, new Set());
    starts.get(start).add(name);
  }
  const ordered = [...starts].sort((a, b) => a[0] - b[0]);
  return ordered.map(([from, names], index) => ({ from: index === 0 ? 1 : from, to: index + 1 < ordered.length ? ordered[index + 1][0] - 1 : Infinity, names }));
}

// marksOfTree(root) → every mark the tracked files of a checkout set, each
// `{ path, name, line }`, the blocks they stand on, each `{ from, to, names }`
// by the path of its file, and the artifacts that set none.
export function marksOfTree(root = repoRoot) {
  const marks = [];
  const orphans = [];
  const blocks = new Map();
  for (const path of git(root, 'ls-files').split('\n').filter(Boolean)) {
    const byPath = PATH_MARKS.map(pattern => pattern.exec(path)?.[1]).find(Boolean);
    if (byPath !== undefined) {
      marks.push({ path, name: byPath, line: 1 });
      blocks.set(path, [{ from: 1, to: Infinity, names: new Set([byPath]) }]);
      continue;
    }
    if (CASES.test(path)) {
      // A file of a chapter marks its section, and a case in it the record
      // in transit over it [QSWRK#cases].
      const section = /\/(QS[A-Z]{3})\/([^/]+)\.jsonl$/.exec(path);
      const found = [...(section === null ? [] : [{ name: `${section[1]}#${section[2]}`, line: 1 }]), ...marksOfCases(readFileSync(join(root, path), 'utf8'))];
      marks.push(...found.map(mark => ({ path, ...mark })));
      blocks.set(path, found.map(({ name, line }) => ({ from: line, to: line, names: new Set([name]) })));
      continue;
    }
    if (!isArtifact(path)) continue;
    const text = readFileSync(join(root, path), 'utf8');
    const found = marksOfText(text, MARK);
    if (found.length === 0) orphans.push(path);
    marks.push(...found.map(mark => ({ path, ...mark })));
    if (found.length > 0) blocks.set(path, blocksOf(found, text, path));
  }
  return { marks, orphans, blocks };
}

// The commit each record in force was last described in: the newest that
// changed a line of it beyond a link, a statement of fate and a citation
// a merge or a move wrote anew, which leave its decision as it was.
const LINK_OR_FATE = new RegExp(`${LINK_DEFINITION.source}|^(Pruned of what|Replaced by|Merged into) `);
const CITATIONS = /\[[DE]\d+(?:,\s*[DE]\d+)*\](?:(?:,\s*|,?\s+and\s+)\[[DE]\d+(?:,\s*[DE]\d+)*\])*/g;
const beyondCitations = text => text.replace(CITATIONS, '').replace(/"decision":(\[[^\]]*\]|"[^"]*")/g, '"decision":D').replace(/\s+/g, ' ').trim();
// The lines of a record's hunk that are its decision: a statement of fate,
// `Replaces in part` and the lines that continue it among them, and a link
// leave it as it was.
const FIELD_OR_LINK = new RegExp(`${FIELD_OPENS.source}|${LINK_DEFINITION.source}`);
function decisionOf(lines) {
  let inFate = false;
  return beyondCitations(lines.filter(line => {
    if (FATE.test(line)) inFate = true;
    else if (FIELD_OR_LINK.test(line) || line.trim() === '') inFate = false;
    return !inFate && !LINK_OR_FATE.test(line);
  }).join(' '));
}

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

// The lines of the present files among the paths that a diff since a
// commit changed beyond the citations of decisions, a mark, its line `The
// decisions it exists for` or a case's `decision`, which leave what a file
// does as it was: the ranges of the hunks that change more, by the path
// of their file, a hunk that only removes reaching the lines around it.
const MARK_STATEMENT = /The decisions? it exists for: [^.]*\./;
const beyondMarks = lines => beyondCitations(lines.map(line => line.replace(MARK_STATEMENT, ''))
  .filter(line => !/^\s*(\/\/|#|\*)?\s*$/.test(line)).join(' '));

function changedBeyondCitations(root, commit, paths) {
  const changed = new Map();
  const diff = git(root, 'diff', '-U0', '-M', '--no-color', commit, '--', ...paths);
  for (const section of diff.split(/^diff --git /m).slice(1)) {
    const path = section.match(/^a\/\S+ b\/(\S+)\n/)?.[1];
    if (path === undefined) continue;
    for (const hunk of section.split(/^(?=@@ )/m).slice(1)) {
      const [, from, count] = hunk.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/) ?? [];
      if (from === undefined) continue;
      const lines = hunk.split('\n').slice(1);
      const removed = lines.filter(line => line.startsWith('-')).map(line => line.slice(1));
      const added = lines.filter(line => line.startsWith('+')).map(line => line.slice(1));
      if (beyondMarks(removed) === beyondMarks(added)) continue;
      const start = Number(from);
      const length = count === undefined ? 1 : Number(count);
      if (!changed.has(path)) changed.set(path, []);
      changed.get(path).push({ from: start, to: length === 0 ? start + 1 : start + length - 1, text: hunk.trimEnd() });
    }
  }
  return changed;
}

function describedIn(root) {
  const inForce = new Set(git(root, 'ls-files', JOURNAL).split('\n').map(path => path.match(/^docs\/journal\/([DE]\d+)\.md$/)?.[1]).filter(Boolean));
  const described = new Map();
  const log = git(root, 'log', '-p', '-M', '--unified=0', '--format=%x00%H', '--', JOURNAL);
  for (const entry of log.split('\0').slice(1)) {
    const commit = entry.slice(0, entry.indexOf('\n'));
    for (const [name, { removed, added }] of sidesOf(entry, section => section.match(/^a\/\S+ b\/docs\/journal\/([DE]\d+)\.md\n/)?.[1])) {
      if (!inForce.has(name) || described.has(name)) continue;
      if (decisionOf(removed) !== decisionOf(added)) described.set(name, commit);
    }
  }
  return described;
}

// touchedRecords(root, { debt }) → the records in force whose scope the
// tree changed since it was read against them, each `{ name, commit,
// files, hunks }`, the hunks of its blocks each `{ path, text }`, the
// changes the working tree holds among them: what a move of
// the baseline reads again against the new root [QSWRK#marks]. A record is read
// against the later of the commit that last described it and the
// baseline, whose move read again every record its diff touched; with
// `debt`, against the commit that described it alone, the records no move
// read again before the marks were set.
export function touchedRecords(root = repoRoot, { debt = false, baseline = baselineOf(root) } = {}) {
  const { blocks } = marksOfTree(root);
  const blocksOfRecord = new Map();
  for (const [path, fileBlocks] of blocks) {
    for (const block of fileBlocks) {
      for (const name of block.names) {
        if (!blocksOfRecord.has(name)) blocksOfRecord.set(name, new Map());
        const byPath = blocksOfRecord.get(name);
        if (!byPath.has(path)) byPath.set(path, []);
        byPath.get(path).push(block);
      }
    }
  }
  const sinceBaseline = debt || baseline === null ? null : new Set(git(root, 'rev-list', `${baseline}..HEAD`).split('\n').filter(Boolean));
  const namesOf = new Map();
  for (const [name, described] of describedIn(root)) {
    if (!blocksOfRecord.has(name)) continue;
    const commit = sinceBaseline === null || sinceBaseline.has(described) ? described : baseline;
    if (!namesOf.has(commit)) namesOf.set(commit, []);
    namesOf.get(commit).push(name);
  }
  const touched = [];
  for (const [commit, names] of namesOf) {
    const changed = changedBeyondCitations(root, commit, [...new Set(names.flatMap(name => [...blocksOfRecord.get(name).keys()]))]);
    for (const name of names) {
      const hunks = [...blocksOfRecord.get(name)].flatMap(([path, recordBlocks]) => (changed.get(path) ?? [])
        .filter(({ from, to }) => recordBlocks.some(block => from <= block.to && to >= block.from)).map(({ text }) => ({ path, text })));
      const files = [...new Set(hunks.map(({ path }) => path))];
      if (files.length > 0) touched.push({ name, commit, files, hunks });
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
    const debt = argument === '--debt';
    const touched = touchedRecords(repoRoot, { debt });
    for (const { name, commit, files } of touched) console.log(`${name}\t${commit.slice(0, 8)}\t${files.length}\t${files.join(' ')}`);
    console.log(`touched: ${touched.length} records in force whose scope the tree changed since ${debt ? 'they were described' : 'they were read against it, the later of their description and the baseline'} [QSWRK#marks]`);
  } else if (command === '--reread') {
    const debt = process.argv.includes('--debt');
    const record = touchedRecords(repoRoot, { debt }).find(({ name }) => name === argument);
    if (record === undefined) console.log(`${argument}: no block of it changed since it was read against the ${debt ? 'commit that described it' : 'later of its description and the baseline'} [QSWRK#marks]`);
    else {
      console.log(`${record.name} read against ${record.commit.slice(0, 8)}; the hunks of its blocks since:`);
      for (const { path, text } of record.hunks) console.log(`\n--- ${path}\n${text}`);
    }
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
  } else if (/^(?:[DE]\d+|QS[A-Z]{3}(?:#[a-z][a-z-]*)?)$/.test(command ?? '')) {
    for (const { path, line } of marksOfTree().marks.filter(mark => mark.name === command)) console.log(`${path}:${line}`);
  } else if (command !== undefined && existsSync(resolve(repoRoot, command))) {
    const names = new Set(marksOfTree().marks.filter(mark => mark.path === command.replaceAll('\\', '/')).map(mark => mark.name));
    console.log([...names].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join(' '));
  } else {
    const { orphans } = marksOfTree();
    for (const path of orphans) console.log(path);
    console.log(`marks: ${orphans.length === 0 ? 'every artifact names the decision it exists for' : `${orphans.length} artifacts name no decision [QSWRK#marks]`}`);
    process.exitCode = orphans.length === 0 ? 0 : 1;
  }
}

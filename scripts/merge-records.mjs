// Merges the records of one axis into the earliest of them, the survivor,
// whose number stays the address of the axis [D237]: each record merged
// gains the line `Merged into` the survivor and moves to `replaced/` by
// `scripts/replaced-records.mjs`, and every case, mark, document and
// record in force that named it in prose names the survivor. The
// survivor's text, written anew against the root, is the author's to write
// before the run, and so is a case whose decision the merge would name
// wrongly; the lines the run rewrote in a record in force are listed for
// the author to read. A run again changes nothing.
//
// Usage: node scripts/merge-records.mjs <survivor> <merged>...

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { FATE, LINK_DEFINITION, recordPathOf, statementsOf } from './decision-records.mjs';
import { CITATION_IN_WORDS, CITING_DOCUMENTS } from './baseline-walk.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const [survivor, ...merged] = process.argv.slice(2);
if (survivor === undefined || merged.length === 0) {
  console.error('Usage: node scripts/merge-records.mjs <survivor> <merged>...');
  process.exit(2);
}
const recordPath = name => {
  const path = recordPathOf(repoRoot, name);
  if (path === null) { console.error(`${name} has no record [D237]`); process.exit(2); }
  return posix.relative(repoRoot.replaceAll('\\', '/'), path.replaceAll('\\', '/'));
};
if (recordPath(survivor) !== `docs/decisions/${survivor}.md`) {
  console.error(`${survivor} is not in force, and a record merges into one in force [D237]`);
  process.exit(2);
}
// A survivor that names no decider takes none of a merged record's by
// itself: its author writes the line, the parts of each record named [D155].
const decides = name => /^Decided by\./m.test(readFileSync(join(repoRoot, recordPath(name)), 'utf8'));
if (!decides(survivor) && merged.some(decides)) {
  console.error(`${survivor} names no decider while a record merged into it does: write its \`Decided by.\` line first [D155]`);
  process.exit(2);
}
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 26 });
const tracked = git('ls-files').split('\n').filter(Boolean);
const rewrite = (path, change) => {
  const raw = readFileSync(join(repoRoot, path), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.split('\r\n').join('\n');
  const written = change(text);
  if (written !== text) writeFileSync(join(repoRoot, path), written.split('\n').join(eol));
  return written !== text;
};
const order = name => (name.startsWith('E') ? 100000 : 0) + Number(name.slice(1));
const earlier = merged.filter(name => order(name) < order(survivor));
if (earlier.length > 0) {
  console.error(`${earlier.join(' ')} came before ${survivor}: the earliest record of an axis stays, and the later ones merge into it [D237]`);
  process.exit(2);
}

// A citation of a record merged names the survivor, and a run of
// citations that comes to name it twice names it once, in the order of
// the records; a definition of a link is left to `relink`, and the
// source of a record and a statement of fate, which tell its history,
// keep the record they named.
function cite(text, isRecord = false) {
  const lines = text.split('\n');
  const history = statement => FATE.test(statement.text) || statement.text.startsWith('Source. ');
  const fate = new Set(isRecord ? statementsOf(text).filter(history).flatMap(({ from, to }) => Array.from({ length: to - from + 1 }, (_, index) => from + index)) : []);
  const written = [];
  let prose = [];
  const flush = () => { if (prose.length > 0) written.push(...citeProse(prose.join('\n')).split('\n')); prose = []; };
  lines.forEach((line, index) => {
    if (LINK_DEFINITION.test(line) || fate.has(index)) { flush(); written.push(line); } else prose.push(line);
  });
  flush();
  return written.join('\n');
}

// A run of citations, `[Dnn], [Dnn] and [Dnn]` across the lines it wraps
// over, names its records in their order, each once, and keeps its
// separators where they stand, a line break before any other.
function citeProse(text) {
  let written = text;
  for (const name of merged) written = written.replaceAll(`[${name}]`, `[${survivor}]`);
  // A citation a document writes in words, which the walk reads beside
  // the brackets.
  written = written.replace(CITATION_IN_WORDS, (run, list) => {
    const names = list.split(/,\s*| and /);
    if (!names.some(name => merged.includes(name))) return run;
    const kept = [...new Set(names.map(name => (merged.includes(name) ? survivor : name)))].sort((a, b) => order(a) - order(b));
    const spelled = kept.length === 1 ? kept[0] : `${kept.slice(0, -1).join(', ')} and ${kept.at(-1)}`;
    return `${kept.length === 1 ? 'decision' : 'decisions'} ${spelled}`;
  });
  return written.replace(/\[[DE]\d+\](?:(?:,\s*|,?\s+and\s+)\[[DE]\d+\])+/g, run => {
    if (!run.includes(`[${survivor}]`)) return run;
    const names = [...new Set(run.match(/[DE]\d+/g))].sort((a, b) => order(a) - order(b));
    const separators = run.split(/\[[DE]\d+\]/).slice(1, -1);
    while (separators.length > names.length - 1) {
      const plain = separators.findIndex((separator, index) => !separator.includes('\n') && !(index === separators.length - 1 && separator.includes('and')));
      separators.splice(plain !== -1 ? plain : Math.max(separators.findIndex(separator => !separator.includes('\n')), 0), 1);
    }
    return names.map((name, index) => `${index === 0 ? '' : separators[index - 1]}[${name}]`).join('');
  });
}

// A document's definitions of links: a record merged it no longer cites
// loses its own, and the survivor it cites gains one among the others.
function relink(path, text) {
  const lines = text.split('\n');
  const body = lines.filter(line => !LINK_DEFINITION.test(line)).join('\n');
  const cites = name => body.includes(`[${name}]`);
  let kept = lines.filter(line => !(LINK_DEFINITION.test(line) && merged.includes(line.match(LINK_DEFINITION)[1]) && !cites(line.match(LINK_DEFINITION)[1])));
  if (cites(survivor) && !kept.some(line => line.match(LINK_DEFINITION)?.[1] === survivor) && lines.some(line => LINK_DEFINITION.test(line))) {
    const definition = `[${survivor}]: ${posix.relative(posix.dirname(path), `docs/decisions/${survivor}.md`)}`;
    const indices = kept.map((line, index) => (LINK_DEFINITION.test(line) ? index : -1)).filter(index => index !== -1);
    const after = indices.find(index => order(kept[index].match(LINK_DEFINITION)[1]) > order(survivor));
    const at = after ?? (indices.length > 0 ? indices.at(-1) + 1 : kept.length);
    if (indices.length === 0) {
      while (kept.at(-1) === '') kept.pop();
      kept = [...kept, '', definition, ''];
    } else kept.splice(at, 0, definition);
  }
  return kept.join('\n');
}

// Each record merged names the survivor in its line of fate.
for (const name of merged) {
  rewrite(recordPath(name), text => {
    if (new RegExp(`^Merged into \\[${survivor}\\]`, 'm').test(text)) return text;
    const lines = text.replace(/\n+$/, '').split('\n');
    const firstLink = lines.findIndex(line => LINK_DEFINITION.test(line));
    const body = firstLink === -1 ? lines : lines.slice(0, firstLink);
    const links = firstLink === -1 ? [] : lines.slice(firstLink);
    while (body.at(-1) === '') body.pop();
    body.push(`Merged into [${survivor}].`);
    if (!links.some(line => line.startsWith(`[${survivor}]:`))) {
      const after = links.findIndex(line => LINK_DEFINITION.test(line) && order(line.match(LINK_DEFINITION)[1]) > order(survivor));
      links.splice(after === -1 ? links.length : after, 0, `[${survivor}]: ${survivor}.md`);
    }
    return [...body, '', ...links, ''].join('\n');
  });
}

// A case names the survivor where it named a record merged; only its
// field of decision is written again.
for (const path of tracked.filter(path => /^core\/test\/conformance\/.*\.jsonl$/.test(path))) {
  rewrite(path, text => text.split('\n').map(line => {
    if (line.trim() === '' || line.trim().startsWith('//')) return line;
    const named = [JSON.parse(line).decision ?? []].flat();
    if (!named.some(name => merged.includes(name))) return line;
    const renamed = [...new Set(named.map(name => (merged.includes(name) ? survivor : name)))].sort((a, b) => order(a) - order(b));
    return line.replace(/"decision":(\[[^\]]*\]|"[^"]*")/, () => `"decision":${JSON.stringify(renamed.length === 1 ? renamed[0] : renamed)}`);
  }).join('\n'));
}

// A mark of an artifact, a citation of a document of the work and one of a
// record in force name the survivor.
const ARTIFACT = /\.(mjs|js|peggy|qlang)$|^\.github\/workflows\//;
// The documents the walk holds to the records in force [D225].
const isDocument = path => CITING_DOCUMENTS.includes(path);
const RECORD_IN_FORCE = /^docs\/decisions\/[DE]\d+\.md$/;
const isRecordMerged = path => [survivor, ...merged].some(name => path === `docs/decisions/${name}.md`);
const touched = [];
for (const path of tracked.filter(path => (ARTIFACT.test(path) && !path.startsWith('docs/')) || isDocument(path) || (RECORD_IN_FORCE.test(path) && !isRecordMerged(path)))) {
  const before = readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/);
  if (rewrite(path, text => (path.endsWith('.md') ? relink(path, cite(text, RECORD_IN_FORCE.test(path))) : cite(text)))) {
    touched.push(path);
    if (RECORD_IN_FORCE.test(path)) {
      const after = readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/);
      after.forEach((line, index) => { if (!before.includes(line) && !LINK_DEFINITION.test(line)) console.log(`  ${path}:${index + 1}  ${line}`); });
    }
  }
}
console.log(`merged ${merged.join(' ')} into ${survivor}; citations written again in ${touched.length} files`);
execFileSync('node', ['scripts/replaced-records.mjs'], { cwd: repoRoot, stdio: 'inherit' });

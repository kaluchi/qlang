// Merges records about one thing into the one that holds them [D237]: each
// record merged gains its line of fate naming the survivor and moves to
// `replaced/` by `scripts/replaced-records.mjs`, and every case, mark,
// document and record in force that named it names the survivor. The
// survivor's text, written anew against the root, is the author's to write
// before the run, and so is a case whose decision the merge would name
// wrongly; a record in force keeps what it cites, and the lines the run
// rewrote in one are listed for the author to read. A run again changes
// nothing.
//
// Usage: node scripts/merge-records.mjs <survivor> <merged>...

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { recordPathOf } from './decision-records.mjs';

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
const DEFINITION = /^\[([DE]\d+)\]: /;

// A citation of a record merged names the survivor, and a run of
// citations that comes to name it twice names it once, in the order of
// the records; a definition of a link is left to `relink`.
function cite(text) {
  return text.split('\n').map(line => {
    if (DEFINITION.test(line)) return line;
    let written = line;
    for (const name of merged) written = written.replaceAll(`[${name}]`, `[${survivor}]`);
    return written.replace(/\[[DE]\d+\](?:,\s*\[[DE]\d+\])+/g, run => {
      if (!run.includes(`[${survivor}]`)) return run;
      const names = [...new Set(run.match(/[DE]\d+/g))].sort((a, b) => order(a) - order(b));
      return names.map(name => `[${name}]`).join(', ');
    });
  }).join('\n');
}

// A document's definitions of links: a record merged it no longer cites
// loses its own, and the survivor it cites gains one among the others.
function relink(path, text) {
  const lines = text.split('\n');
  const body = lines.filter(line => !DEFINITION.test(line)).join('\n');
  const cites = name => body.includes(`[${name}]`);
  let kept = lines.filter(line => !(DEFINITION.test(line) && merged.includes(line.match(DEFINITION)[1]) && !cites(line.match(DEFINITION)[1])));
  if (cites(survivor) && !kept.some(line => line.startsWith(`[${survivor}]: `))) {
    const definition = `[${survivor}]: ${posix.relative(posix.dirname(path), `docs/decisions/${survivor}.md`)}`;
    const indices = kept.map((line, index) => (DEFINITION.test(line) ? index : -1)).filter(index => index !== -1);
    const after = indices.find(index => order(kept[index].match(DEFINITION)[1]) > order(survivor));
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
    if (new RegExp(`^Replaced by \\[${survivor}\\]`, 'm').test(text)) return text;
    const lines = text.replace(/\n+$/, '').split('\n');
    const firstLink = lines.findIndex(line => DEFINITION.test(line));
    const body = firstLink === -1 ? lines : lines.slice(0, firstLink);
    const links = firstLink === -1 ? [] : lines.slice(firstLink);
    while (body.at(-1) === '') body.pop();
    body.push(`Replaced by [${survivor}], which holds what it decided, the records about one thing merged into one.`);
    if (!links.some(line => line.startsWith(`[${survivor}]:`))) links.push(`[${survivor}]: ${survivor}.md`);
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
const DOCUMENT = /^docs\/qlang-(audit|entrypoint)\.md$|^CLAUDE\.md$/;
const RECORD_IN_FORCE = /^docs\/decisions\/[DE]\d+\.md$/;
const isRecordMerged = path => [survivor, ...merged].some(name => path === `docs/decisions/${name}.md`);
const touched = [];
for (const path of tracked.filter(path => (ARTIFACT.test(path) && !path.startsWith('docs/')) || DOCUMENT.test(path) || (RECORD_IN_FORCE.test(path) && !isRecordMerged(path)))) {
  const before = readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/);
  if (rewrite(path, text => (path.endsWith('.md') ? relink(path, cite(text)) : cite(text)))) {
    touched.push(path);
    if (RECORD_IN_FORCE.test(path)) {
      const after = readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/);
      after.forEach((line, index) => { if (!before.includes(line) && !DEFINITION.test(line)) console.log(`  ${path}:${index + 1}  ${line}`); });
    }
  }
}
console.log(`merged ${merged.join(' ')} into ${survivor}; citations written again in ${touched.length} files`);
execFileSync('node', ['scripts/replaced-records.mjs'], { cwd: repoRoot, stdio: 'inherit' });

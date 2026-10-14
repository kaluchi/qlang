// Dissolves records in transit into the sections they override, at the
// move of the baseline [D283]: the author has written the sections anew
// in the present, and the run does the rest. A case under a chapter that
// names the record drops the name; a citation of the record in the code,
// the tests and the documents of the work names its section where the
// record overrides one, and is listed for the author where it overrides
// several; the record gains its line `Dissolved into` the sections and
// leaves for `replaced/` by `scripts/replaced-records.mjs`. A record that
// overrides nothing, or a case outside the chapters that names it, is
// refused, since the case has no section to rest in yet.
//
// Usage: node scripts/dissolve-records.mjs <Dnn>...

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CITING_DOCUMENTS, recordsInTransit } from './baseline-walk.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const names = process.argv.slice(2);
if (names.length === 0) { console.error('Usage: node scripts/dissolve-records.mjs <Dnn>...'); process.exit(2); }
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
const tracked = git('ls-files').split('\n').filter(Boolean);
const transit = recordsInTransit(repoRoot);
const specOf = chapter => readdirSync(join(repoRoot, 'docs', 'spec')).find(name => name.startsWith(`${chapter}-`));
const rewrite = (path, change) => {
  const raw = readFileSync(join(repoRoot, path), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.split('\r\n').join('\n');
  const written = change(text);
  if (written !== text) writeFileSync(join(repoRoot, path), written.split('\n').join(eol));
  return written !== text;
};

const caseFiles = tracked.filter(path => /^core\/test\/conformance\/.*\.jsonl$/.test(path));
for (const name of names) {
  const sections = transit.get(name);
  if (sections === undefined || sections.length === 0) { console.error(`${name} overrides no section: it is no record in transit [D283]`); process.exit(2); }
  const homeless = caseFiles.filter(path => !/\/QS[A-Z]{3}\//.test(path))
    .flatMap(path => readFileSync(join(repoRoot, path), 'utf8').split(/\r?\n/).filter(line => line.includes(`"decision":"${name}"`)).map(line => `${path}#${JSON.parse(line).name}`));
  if (homeless.length > 0) { console.error(`${name} gates cases outside the chapters, which have no section to rest in:\n  ${homeless.join('\n  ')}`); process.exit(2); }
}

for (const name of names) {
  const sections = transit.get(name);
  // The cases under a chapter rest in their section.
  for (const path of caseFiles.filter(file => /\/QS[A-Z]{3}\//.test(file))) {
    rewrite(path, text => text.split('\n').map(line => {
      if (!line.includes(`"decision":"${name}"`)) return line;
      const { decision: _decision, ...rest } = JSON.parse(line);
      return JSON.stringify(rest);
    }).join('\n'));
  }
  // A citation names the section, or waits for the author.
  const citing = tracked.filter(path => (/\.(mjs|js|peggy|qlang)$/.test(path) && !path.startsWith('docs/')) || CITING_DOCUMENTS.includes(path));
  const left = [];
  for (const path of citing) {
    rewrite(path, text => {
      if (!text.includes(`[${name}]`)) return text;
      if (sections.length === 1) return text.replaceAll(`[${name}]`, `[${sections[0]}]`);
      text.split('\n').forEach((line, index) => { if (line.includes(`[${name}]`)) left.push(`${path}:${index + 1}`); });
      return text;
    });
  }
  if (left.length > 0) console.log(`${name} overrides ${sections.join(', ')}; name the section at each of:\n  ${left.join('\n  ')}`);
  // The line of its fate, and the links to the sections as `replaced/` reads them.
  rewrite(`docs/decisions/${name}.md`, text => {
    const lines = text.replace(/\n+$/, '').split('\n');
    const firstLink = lines.findIndex(line => /^\[[DE]\d+\]: \S+\.md$/.test(line) || /^\[QS[A-Z]{3}/.test(line));
    const body = firstLink === -1 ? lines : lines.slice(0, firstLink);
    const links = firstLink === -1 ? [] : lines.slice(firstLink);
    while (body.at(-1) === '') body.pop();
    const cited = sections.map(section => `[${section}]`);
    body.push(`Dissolved into ${cited.length === 1 ? cited[0] : `${cited.slice(0, -1).join(', ')} and ${cited.at(-1)}`}.`);
    const definitions = sections.map(section => {
      const [chapter, anchor] = section.split('#');
      return `[${section}]: ../../spec/${specOf(chapter)}${anchor === undefined ? '' : `#${anchor}`}`;
    }).filter(definition => !links.some(line => line.startsWith(definition.split(':')[0] + ':')));
    return [...body, '', ...links.map(line => line.replace(/^(\[QS[A-Z]{3}[^\]]*\]: )\.\.\/spec\//, '$1../../spec/')), ...definitions, ''].join('\n');
  });
  console.log(`${name} dissolved into ${sections.join(', ')}`);
}
execFileSync('node', ['scripts/replaced-records.mjs'], { cwd: repoRoot, stdio: 'inherit' });

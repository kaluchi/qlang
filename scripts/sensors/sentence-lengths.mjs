#!/usr/bin/env node
// The length of a sentence in the texts that state what holds: the prose of
// the chapters outside their fenced blocks and the docs of the catalog,
// each sentence counted in words, how many run past a bound and the longest
// [QSWRK#documents].
//
//   node scripts/sensors/sentence-lengths.mjs [bound]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
const bound = Number(process.argv[2] ?? 60);

// The prose of a chapter, its fenced blocks left out, and of the docs of a
// source of the catalog, `|~~ … ~~|`.
const proseOfChapter = text => text.split(/^```[\s\S]*?^```/m).join('\n').replace(/^#.*$/gm, '');
const proseOfSource = text => [...text.matchAll(/\|~~([\s\S]*?)~~\|/g)].map(match => match[1]).join('\n');

// The sentences of prose, each cut at a full stop that ends a word before a
// space and a capital, a span of code or the end, a span of code one word,
// its words those its spaces part.
const sentencesOf = prose => prose.replace(/`[^`]*`/g, 'Code').replace(/\s+/g, ' ')
  .split(/(?<=[.!?])\s+(?=[A-Z(])/).map(sentence => sentence.trim()).filter(sentence => /[a-z]/.test(sentence));
const wordsOf = sentence => sentence.split(' ').filter(Boolean).length;

const catalogFiles = dir => readdirSync(join(root, dir), { withFileTypes: true })
  .flatMap(entry => (entry.isDirectory() ? catalogFiles(join(dir, entry.name)) : entry.name.endsWith('.qlang') ? [join(dir, entry.name)] : []));

const texts = [
  ['chapters', readdirSync(join(root, 'docs/spec')).filter(name => /^QS.*\.md$/.test(name)).map(name => proseOfChapter(readFileSync(join(root, 'docs/spec', name), 'utf8')))],
  ['pages', ['core/lib', 'cli/lib'].flatMap(catalogFiles).map(file => proseOfSource(readFileSync(join(root, file), 'utf8')))]
];
for (const [name, proses] of texts) {
  const lengths = proses.flatMap(sentencesOf).map(wordsOf).sort((a, b) => a - b);
  const past = lengths.filter(length => length > bound).length;
  const median = lengths[Math.floor(lengths.length / 2)];
  console.log(`${name}: ${lengths.length} sentences, median ${median} words, ${past} past ${bound}, the longest ${lengths.at(-1)}`);
}

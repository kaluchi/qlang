#!/usr/bin/env node
// The length of a sentence in the texts that state what holds: the prose of
// the chapters outside their fenced blocks and the docs of the catalog,
// each sentence counted in words, how many run past a bound and the longest
// [QSVOX#chapter].
// sentencesOfPages(root) → each sentence of the docs of the catalog with
// its file and its count of words, which `check:conventions` bounds.
//
//   node scripts/sensors/sentence-lengths.mjs [bound]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The prose of a chapter, its fenced blocks left out, and of the docs of a
// source of the catalog, `|~~ … ~~|`, each doc apart, a span of code one
// word before the docs are read, so a doc written inside a span is none,
// and a link and a snippet left out.
const proseOfChapter = text => text.split(/^```[\s\S]*?^```/m).join('\n').replace(/^#.*$/gm, '');
const CODE_SPAN = /`[^`\n]*(?:\n[^`\n]*)?`/g;
const LINK_OR_SNIPPET = /(?:::[A-Za-z][\w/]*)+~\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
const docsOfSource = text => [...text.replace(CODE_SPAN, 'Code').matchAll(/\|~~(?!\|)([\s\S]*?)~~\|/g)]
  .map(match => match[1].replace(LINK_OR_SNIPPET, ' '));

// The sentences of prose, each cut at a full stop that ends a word before a
// space and a capital, a span of code or the end, a span of code one word,
// its words those its spaces part.
const sentencesOf = prose => prose.replace(/`[^`]*`/g, 'Code').replace(/\s+/g, ' ')
  .split(/(?<=[.!?])\s+(?=[A-Z(])/).map(sentence => sentence.trim()).filter(sentence => /[a-z]/.test(sentence));
const wordsOf = sentence => sentence.split(' ').filter(Boolean).length;

const catalogFiles = (root, dir) => readdirSync(join(root, dir), { withFileTypes: true })
  .flatMap(entry => (entry.isDirectory() ? catalogFiles(root, join(dir, entry.name)) : entry.name.endsWith('.qlang') ? [join(dir, entry.name)] : []));

export function sentencesOfPages(root) {
  return ['core/lib', 'stdio/lib', 'playground/lib'].flatMap(dir => catalogFiles(root, dir)).flatMap(file => {
    const path = file.split('\\').join('/');
    return docsOfSource(readFileSync(join(root, file), 'utf8')).flatMap(sentencesOf).map(sentence => ({ path, sentence, words: wordsOf(sentence) }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
  const bound = Number(process.argv[2] ?? 60);
  const texts = [
    ['chapters', readdirSync(join(root, 'docs/spec')).filter(name => /^QS.*\.md$/.test(name)).flatMap(name => sentencesOf(proseOfChapter(readFileSync(join(root, 'docs/spec', name), 'utf8')))).map(wordsOf)],
    ['pages', sentencesOfPages(root).map(({ words }) => words)]
  ];
  for (const [name, counts] of texts) {
    const lengths = [...counts].sort((a, b) => a - b);
    const past = lengths.filter(length => length > bound).length;
    console.log(`${name}: ${lengths.length} sentences, median ${lengths[Math.floor(lengths.length / 2)]} words, ${past} past ${bound}, the longest ${lengths.at(-1)}`);
  }
  if (process.argv.includes('--pages')) {
    for (const { path, sentence, words } of sentencesOfPages(root).filter(({ words }) => words > bound).sort((a, b) => b.words - a.words)) {
      console.log(`${String(words).padStart(4)}  ${path}  ${sentence.slice(0, 120)}`);
    }
  }
}

#!/usr/bin/env node
// How much a comment of the code that cites a section says that section
// again: the share of its pairs of words, two words in a row but the words of
// grammar, that the text of the sections it cites holds, beside the share a
// section it does not cite holds, drawn at random, which measures the words
// any two texts of the language share [QSWRK#code].
//
//   node scripts/sensors/comment-echo.mjs [blocks shown]

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const shown = Number(process.argv[2] ?? 8);
const tracked = (...paths) => execFileSync('git', ['ls-files', ...paths], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const read = path => readFileSync(join(root, path), 'utf8');

const GRAMMAR = new Set('the a an of to in on at by for and or as is are be its it that this which whose who what where when with from into than then so no not one each every any all their them they there here was were has have had do does done can may must also only but over under after before between'.split(' '));
const wordsOf = text => text.toLowerCase().replace(/`[^`]*`/g, ' ').replace(/\[[^\]]*\]/g, ' ').match(/[a-z]+/g)?.filter(word => word.length > 2 && !GRAMMAR.has(word)) ?? [];
const pairsOf = text => {
  const words = wordsOf(text);
  return words.slice(1).map((word, at) => `${words[at]} ${word}`);
};

// The text of each section, `QSNAM#scope`, the words of its prose and its probes.
const sections = new Map();
for (const path of tracked('docs/spec/QS*.md')) {
  const chapter = /(QS[A-Z]{3})-/.exec(path)[1];
  let section = null;
  for (const line of read(path).split(/\r?\n/)) {
    const heading = /^## (\S+)/.exec(line);
    if (heading) sections.set(section = `${chapter}#${heading[1]}`, []);
    else if (section) sections.get(section).push(line);
  }
}
const pairsOfSection = new Map([...sections].map(([key, lines]) => [key, new Set(pairsOf(lines.join(' ')))]));
const keys = [...sections.keys()];

// The blocks of comments of the code, a run of lines that open with `//`.
const blocks = [];
for (const path of tracked('core/src', 'cli/src', 'lsp/src').filter(path => /\.(mjs|peggy)$/.test(path))) {
  let block = null;
  read(path).split(/\r?\n/).forEach((line, index) => {
    if (/^\s*\/\//.test(line)) (block ??= { path, line: index + 1, lines: [] }).lines.push(line.replace(/^\s*\/\/\s?/, ''));
    else if (block !== null) blocks.push(block), block = null;
  });
}

let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const measured = blocks.flatMap(block => {
  const text = block.lines.join(' ');
  const cited = [...new Set([...text.matchAll(/\[(QS[A-Z]{3}#[a-z][a-z-]*)\]/g)].map(match => match[1]))].filter(key => pairsOfSection.has(key));
  const pairs = pairsOf(text);
  if (cited.length === 0 || pairs.length < 4) return [];
  const other = keys.filter(key => !cited.includes(key))[Math.floor(random() * (keys.length - cited.length))];
  const share = holds => pairs.filter(holds).length / pairs.length;
  return [{ ...block, text, words: wordsOf(text).length, echo: share(pair => cited.some(key => pairsOfSection.get(key).has(pair))), chance: share(pair => pairsOfSection.get(other).has(pair)) }];
});
const percent = share => `${Math.round(share * 100)}%`;
const past = (field, bound) => measured.filter(block => block[field] >= bound).length / measured.length;
console.log(`blocks of comments citing a section in four pairs of words or more: ${measured.length} of ${blocks.length}`);
for (const bound of [0.25, 0.5]) console.log(`  with ${percent(bound)} of their pairs or more in the sections they cite ${percent(past('echo', bound))}, in a section they do not ${percent(past('chance', bound))}`);
for (const block of measured.filter(block => block.words >= 8).sort((left, right) => right.echo - left.echo).slice(0, shown)) {
  console.log(`${percent(block.echo).padStart(5)}  ${block.path}:${block.line}  ${block.text.slice(0, 160)}`);
}

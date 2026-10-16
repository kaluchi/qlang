// The measures of the vocabulary of the project, read in its own texts, the
// texts that state what holds [D349]: the selectivity of a term, the share
// of its matches that stand in the files naming its anchor; the consistency
// of a pair of terms that work together, the share of the files writing the
// first that write the second; and the rivals of a concept, the matches of
// each word that names it in the files naming its anchor. With `--corpus`,
// the prior of a term beside them, the files of a corpus of other projects
// that write it, the `node_modules` of the checkout.
//
// Usage: node scripts/sensors/vocabulary.mjs <term>[=<anchor>]... [--pair <a>:<b>]... [--rivals <anchor>=<word>,<word>...]... [--corpus]
// e.g.   node scripts/sensors/vocabulary.mjs frame=::frame --pair trail:frame --rivals ::frame=trail,trace,path

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const TEXTS = ['docs/spec', 'core/lib', 'cli/lib', 'core/src', 'cli/src', 'lsp/src', 'site/src', 'core/test', 'cli/test', 'lsp/test', 'CLAUDE.md', 'README.md', 'core/README.md', 'cli/README.md'];
const CORPUS = join(repoRoot, 'node_modules');

const args = process.argv.slice(2);
const terms = [];
const pairs = [];
const rivals = [];
let withCorpus = false;
for (let at = 0; at < args.length; at++) {
  if (args[at] === '--pair') pairs.push(args[++at].split(':'));
  else if (args[at] === '--rivals') {
    const [anchor, words] = args[++at].split('=');
    rivals.push({ anchor, words: words.split(',') });
  } else if (args[at] === '--corpus') withCorpus = true;
  else {
    const [term, anchor] = args[at].split('=');
    terms.push({ term, anchor: anchor ?? null });
  }
}
if (terms.length === 0 && pairs.length === 0 && rivals.length === 0) {
  console.error('Usage: node scripts/sensors/vocabulary.mjs <term>[=<anchor>]... [--pair <a>:<b>]... [--rivals <anchor>=<word>,<word>...]... [--corpus]');
  process.exit(2);
}

const run = (command, commandArgs) => {
  try {
    return execFileSync(command, commandArgs, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch (failed) {
    return failed.stdout ?? '';
  }
};

// The matches of a word in the texts, by file.
function matchesOf(word) {
  const counted = run('git', ['grep', '-c', '-w', '-i', '-F', word, '--', ...TEXTS]).split('\n').filter(Boolean);
  return new Map(counted.map(line => {
    const at = line.lastIndexOf(':');
    return [line.slice(0, at), Number(line.slice(at + 1))];
  }));
}

const filesNaming = anchor => new Set(run('git', ['grep', '-l', '-F', anchor, '--', ...TEXTS]).split('\n').filter(Boolean));
const sum = counts => [...counts].reduce((total, [, count]) => total + count, 0);
const percent = (part, whole) => (whole === 0 ? '-' : `${Math.round((100 * part) / whole)}%`);
const corpusFiles = term => new Set(run('rg', ['-l', '-w', '-i', '-F', term, CORPUS, '-g', '*.{js,mjs,cjs,ts,md}']).split('\n').filter(Boolean));
const priorOf = term => (withCorpus && existsSync(CORPUS) ? `; ${corpusFiles(term).size} files of the corpus` : '');

for (const { term, anchor } of terms) {
  const ours = matchesOf(term);
  const near = anchor === null ? null : filesNaming(anchor);
  const share = near === null ? '' : `, ${percent(sum([...ours].filter(([file]) => near.has(file))), sum(ours))} of them in the ${near.size} files that name ${anchor}`;
  console.log(`${term}: ${sum(ours)} matches in ${ours.size} files${share}${priorOf(term)}`);
}
for (const [first, second] of pairs) {
  const withFirst = new Set(matchesOf(first).keys());
  const withSecond = new Set(matchesOf(second).keys());
  const both = [...withFirst].filter(file => withSecond.has(file)).length;
  console.log(`${first}:${second}: ${both} files write both, ${percent(both, withFirst.size)} of the ${withFirst.size} files that write ${first}`);
}
for (const { anchor, words } of rivals) {
  const near = filesNaming(anchor);
  const counts = words.map(word => [word, sum([...matchesOf(word)].filter(([file]) => near.has(file)))]);
  const total = counts.reduce((all, [, count]) => all + count, 0);
  console.log(`${anchor}: ${counts.map(([word, count]) => `${word} ${count} (${percent(count, total)})`).join(', ')} in the ${near.size} files that name it`);
}

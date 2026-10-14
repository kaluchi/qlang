// The walk of the audit's baseline [D225], [D227], read once for
// the conventions, which fail on what it finds, and for the screen of the
// work, which shows it. The audit is held against a commit, its
// baseline. A record of the language that the baseline's tree holds is
// held by a case or closed by the line of its fate; the records written
// since wait for the walk no longer than a working day of them; the lines
// that replace a record in part only fall; and the code, the tests and
// the cases cite the records in force, the documents that hold the work
// those in force or waiting on a target.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readDecisionRecords, replacedWhole, isBeingDecided, isHeld } from './decision-records.mjs';

export const RECORDS_A_WALK_TAKES = 20;
const CITING_CODE_ROOTS = ['core/src', 'core/host', 'core/test/unit', 'cli/src', 'cli/test', 'lsp/src', 'lsp/test', 'vscode/src', 'vscode/test', 'site/src', 'scripts'];
export const CITING_DOCUMENTS = ['docs/qlang-audit.md', 'docs/qlang-entrypoint.md', 'CLAUDE.md', '.claude/agents/qlang-review.md', 'README.md', 'core/README.md', 'cli/README.md', 'lsp/README.md', 'vscode/README.md', 'site/README.md'];
const CODE_FILE = /\.(mjs|js|ts|astro|peggy)$/;
const UNCITING_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets', 'runs']);
// A citation a document writes in words, `decision Dnn` or `decisions Dnn
// and Dnn`, and one in brackets, `[Dnn, Dnn]`.
export const CITATION_IN_WORDS = /\bdecisions? ((?:[DE]\d+)(?:(?:,\s*| and )[DE]\d+)*)/g;
const CITATION = new RegExp(`\\[((?:[DE]\\d+)(?:,\\s*[DE]\\d+)*)\\]|${CITATION_IN_WORDS.source}`, 'g');

function filesUnder(repoRoot, dir, pattern) {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return UNCITING_FOLDERS.has(entry.name) ? [] : filesUnder(repoRoot, `${dir}/${entry.name}`, pattern);
    return pattern.test(entry.name) ? [`${dir}/${entry.name}`] : [];
  });
}

function citationsIn(text) {
  const cited = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(CITATION)) {
      for (const name of (match[1] ?? match[2]).split(/,\s*| and /)) cited.push({ name, line: index + 1 });
    }
  });
  return cited;
}

function stateOf(record) {
  if (record.mergedInto.length > 0) return `merged into ${record.mergedInto.join(', ')}`;
  if (record.dissolvedInto.length > 0) return `dissolved into ${record.dissolvedInto.join(', ')}`;
  if (replacedWhole(record)) return `closed by ${record.replacedBy.join(', ')}`;
  return isBeingDecided(record) ? 'which no case holds' : 'which a target alone holds';
}

const git = (repoRoot, ...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// baselineOf(repoRoot) → the commit the audit holds itself against, the
// root the last move of the baseline read every record again against.
export const baselineOf = repoRoot => /holds it against commit `([0-9a-f]+)`/
  .exec(readFileSync(join(repoRoot, 'docs', 'qlang-audit.md'), 'utf8').replace(/\s+/g, ' '))?.[1];

// walkOfBaseline(repoRoot) → { baseline, since, partialNow, partialThen,
// violations }: the baseline the audit names, the records written since
// it, the lines that replace a record in part now and at the baseline,
// and every breach of the walk, each `{ where, problem }`.
export function walkOfBaseline(repoRoot) {
  const baseline = baselineOf(repoRoot);
  const walk = { baseline, since: [], partialNow: 0, partialThen: 0, violations: [] };
  if (baseline === undefined) {
    walk.violations.push({ where: 'docs/qlang-audit.md', problem: 'names no baseline commit' });
    return walk;
  }
  let listed;
  try {
    listed = git(repoRoot, 'ls-tree', '-r', '--name-only', baseline, 'docs/decisions/');
  } catch {
    walk.violations.push({ where: 'docs/qlang-audit.md', problem: `names the baseline ${baseline}, which the history lacks` });
    return walk;
  }
  const atBaseline = new Set(listed.split('\n').map(path => /([DE]\d+)\.md$/.exec(path)?.[1]).filter(Boolean));
  const records = readDecisionRecords(repoRoot);
  for (const [name, record] of records) {
    if (atBaseline.has(name) && isBeingDecided(record) && !record.open) {
      walk.violations.push({ where: `docs/decisions/${name}.md`, problem: `outlived the baseline ${baseline}: no case names it and no line gives its fate` });
    }
  }
  walk.since = [...records.keys()].filter(name => !atBaseline.has(name));
  if (walk.since.length > RECORDS_A_WALK_TAKES) {
    walk.violations.push({ where: 'docs/qlang-audit.md', problem: `${walk.since.length} records since the baseline ${baseline}, from ${walk.since[0]}: the walk is due` });
  }
  const partialLines = text => (text.match(/^Replaced in part by/gm) ?? []).length;
  walk.partialNow = [...records.values()].reduce((sum, record) => sum + partialLines(readFileSync(record.path, 'utf8')), 0);
  // `git grep` ends with 1 where no line matches, a baseline that held none.
  try {
    walk.partialThen = git(repoRoot, 'grep', '-c', '^Replaced in part by', baseline, '--', 'docs/decisions')
      .split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(':').pop()), 0);
  } catch {
    walk.partialThen = 0;
  }
  if (walk.partialNow > walk.partialThen) {
    walk.violations.push({ where: 'docs/decisions', problem: `${walk.partialNow} lines replace a record in part, more than the ${walk.partialThen} of the baseline ${baseline}: prune the part a newer record takes` });
  }
  const notClosed = record => !replacedWhole(record) && !isBeingDecided(record);
  for (const file of CITING_CODE_ROOTS.flatMap(root => filesUnder(repoRoot, root, CODE_FILE))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !isHeld(record)) walk.violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
    }
  }
  for (const file of filesUnder(repoRoot, 'core/test/conformance', /\.jsonl$/)) {
    readFileSync(join(repoRoot, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === '' || line.trim().startsWith('//')) return;
      for (const name of [JSON.parse(line).decision ?? []].flat()) {
        const record = records.get(name);
        if (record !== undefined && !notClosed(record)) walk.violations.push({ where: `${file}:${index + 1}`, problem: `names ${name}, ${stateOf(record)}` });
      }
    });
  }
  for (const file of CITING_DOCUMENTS.filter(path => existsSync(join(repoRoot, path)))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !notClosed(record) && !record.open) walk.violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
    }
  }
  for (const { where, problem } of unresolvedSections(repoRoot)) walk.violations.push({ where, problem });
  for (const path of uncitedDocuments(repoRoot)) {
    if (git(repoRoot, 'ls-tree', '--name-only', baseline, '--', path).trim() !== '') {
      walk.violations.push({ where: path, problem: 'no record in force and no document of the work cites it: node scripts/drop-documents.mjs [D282]' });
    }
  }
  return walk;
}

// A citation of the specification, `[QSNAM#scope]` or `[QSNAM]`, names a
// chapter under `docs/spec/` and a section it holds as a heading of its
// own, `## scope` [D283].
const SECTION_CITATION = /\[(QS[A-Z]{3})(?:#([a-z][a-z-]*))?\]/g;
export function unresolvedSections(repoRoot) {
  const specDir = join(repoRoot, 'docs', 'spec');
  const chapters = new Map((existsSync(specDir) ? readdirSync(specDir) : []).filter(name => /^QS[A-Z]{3}-.+\.md$/.test(name))
    .map(name => [name.slice(0, 5), new Set(readFileSync(join(specDir, name), 'utf8').split(/\r?\n/).filter(line => line.startsWith('## ')).map(line => line.slice(3).trim()))]));
  const citing = [...CITING_CODE_ROOTS.flatMap(root => filesUnder(repoRoot, root, CODE_FILE)), ...filesUnder(repoRoot, 'core/test/conformance', /\.jsonl$/),
    ...CITING_DOCUMENTS, ...filesUnder(repoRoot, 'docs/decisions', /\.md$/), ...filesUnder(repoRoot, 'docs/spec', /\.md$/)];
  const unresolved = [];
  for (const file of citing.filter(path => existsSync(join(repoRoot, path)))) {
    readFileSync(join(repoRoot, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
      for (const [whole, chapter, section] of line.matchAll(SECTION_CITATION)) {
        const sections = chapters.get(chapter);
        if (sections === undefined) unresolved.push({ where: `${file}:${index + 1}`, problem: `cites ${whole}, a chapter docs/spec does not hold` });
        else if (section !== undefined && !sections.has(section)) unresolved.push({ where: `${file}:${index + 1}`, problem: `cites ${whole}, a section ${chapter} does not hold` });
      }
    });
  }
  return unresolved;
}

// The documents of the research that stay while something in force cites
// them [D282]. A review is a unit of its own, and so is a chapter the
// audit left; a folder of any other research, a design with its runs, is
// one unit, held by a citation of any of it. The outside audits are a
// series the next one is read against, and the ledger of a folder, its
// README, lists what the folder holds and holds none of it.
const RESEARCH = /^docs\/(research\/(?!outside-audit\/)[^/]+|archive)\/.+/;
const REPORTS = /^docs\/(research\/reviews|archive)\//;
export const isReadme = path => /(^|\/)README\.md$/.test(path);

// The texts in force that may cite a document: the records in force and
// the documents of the work.
export function textsInForce(repoRoot) {
  const records = readdirSync(join(repoRoot, 'docs', 'decisions')).filter(name => /^[DE]\d+\.md$/.test(name)).map(name => `docs/decisions/${name}`);
  return [...records, ...CITING_DOCUMENTS].filter(path => existsSync(join(repoRoot, path))).map(path => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
}

// unitOf(path) → what a citation must name to hold the document: a
// review by its folder and name, `reviews/2026-10-10-vec-set-map.md`, any
// other research by its folder, `research/legend/`.
export const unitOf = path => (REPORTS.test(path) ? path.split('/').slice(-2).join('/') : `${path.split('/').slice(1, 3).join('/')}/`);

// uncitedDocuments(repoRoot) → the documents of the research nothing in
// force cites.
export function uncitedDocuments(repoRoot) {
  const texts = textsInForce(repoRoot);
  return git(repoRoot, 'ls-files', 'docs/research', 'docs/archive').split('\n')
    .filter(path => RESEARCH.test(path) && !isReadme(path))
    .filter(path => !texts.some(({ text }) => text.includes(unitOf(path))));
}

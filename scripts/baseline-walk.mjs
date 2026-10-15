// The walk of the baseline [QSWRK#baseline], [QSWRK#journal], read once for
// the conventions, which fail on what it finds, and for the screen of the
// work, which shows it. The baseline is the last commit that landed a
// branch on master. A record of the language that the baseline's tree holds is
// held by a case or closed by the line of its fate; the records written
// since wait for the walk, twenty at most; the lines
// that replace a record in part only fall; and the code, the tests and
// the cases cite the records in force, the documents that hold the work
// those in force or waiting on a target.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readDecisionRecords, replacedWhole, isBeingDecided, isHeld, JOURNAL, RESEARCH } from './decision-records.mjs';

export const RECORDS_A_WALK_TAKES = 20;
export const CITING_CODE_ROOTS = ['core/src', 'core/host', 'core/lib', 'core/test/unit', 'core/test/helpers', 'core/test/qlang', 'cli/src', 'cli/lib', 'cli/test', 'lsp/src', 'lsp/test', 'vscode/src', 'vscode/test', 'site/src', 'scripts', '.github/workflows'];
export const CITING_DOCUMENTS = ['CLAUDE.md', 'README.md', 'core/README.md', 'cli/README.md', 'lsp/README.md', 'vscode/README.md', 'site/README.md'];
export const CODE_FILE = /\.(mjs|js|ts|astro|peggy|qlang|yml)$/;
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

// The line the branches land on: master, or its copy on the remote where
// a checkout holds no branch of its own.
const mainlineOf = repoRoot => ['master', 'origin/master'].find(ref => {
  try {
    git(repoRoot, 'rev-parse', '--verify', '--quiet', ref);
    return true;
  } catch {
    return false;
  }
});

// baselineOf(repoRoot) → the baseline, the last commit that landed a branch
// on master, a merge on its first parent line [QSWRK#baseline], the root the
// last move of the baseline read every record again against.
export function baselineOf(repoRoot) {
  const mainline = mainlineOf(repoRoot);
  const landed = mainline === undefined ? '' : git(repoRoot, 'rev-list', '-1', '--merges', '--first-parent', mainline).trim();
  return landed === '' ? undefined : landed.slice(0, 8);
}

// A record by its name in the tree of a commit, wherever its journal lay.
const RECORD_FILE = /(?:^|\/)([DE]\d+)\.md$/;

// walkOfBaseline(repoRoot) → { baseline, since, partialNow, partialThen,
// violations }: the baseline, the records written since
// it, the lines that replace a record in part now and at the baseline,
// and every breach of the walk, each `{ where, problem }`.
export function walkOfBaseline(repoRoot) {
  const baseline = baselineOf(repoRoot);
  const walk = { baseline, since: [], partialNow: 0, partialThen: 0, violations: [] };
  if (baseline === undefined) {
    walk.violations.push({ where: 'master', problem: 'no merge on its first parent line lands a branch: the history holds no baseline' });
    return walk;
  }
  const listed = git(repoRoot, 'ls-tree', '-r', '--name-only', baseline, '--', 'docs/');
  const atBaseline = new Set(listed.split('\n').map(path => RECORD_FILE.exec(path)?.[1]).filter(Boolean));
  const records = readDecisionRecords(repoRoot);
  for (const [name, record] of records) {
    if (atBaseline.has(name) && isBeingDecided(record) && !record.open) {
      walk.violations.push({ where: `${JOURNAL}/${name}.md`, problem: `outlived the baseline ${baseline}: no case names it and no line gives its fate` });
    }
  }
  // The merge that landed a branch holds no record in transit: the tension
  // of the work relaxes at it [QSWRK#documents], [QSWRK#baseline].
  if (git(repoRoot, 'rev-parse', 'HEAD').startsWith(baseline)) {
    for (const name of recordsInTransit(repoRoot).keys()) walk.violations.push({ where: `${JOURNAL}/${name}.md`, problem: `in transit at the merge ${baseline} that landed it: dissolve it into its sections or set it aside before the merge` });
  }
  walk.since = [...records.keys()].filter(name => !atBaseline.has(name));
  if (walk.since.length > RECORDS_A_WALK_TAKES) {
    walk.violations.push({ where: JOURNAL, problem: `${walk.since.length} records since the baseline ${baseline}, from ${walk.since[0]}: the walk is due` });
  }
  const partialLines = text => (text.match(/^Replaced in part by/gm) ?? []).length;
  walk.partialNow = [...records.values()].reduce((sum, record) => sum + partialLines(readFileSync(record.path, 'utf8')), 0);
  // `git grep` ends with 1 where no line matches, a baseline that held none.
  try {
    walk.partialThen = git(repoRoot, 'grep', '-c', '^Replaced in part by', baseline, '--', 'docs/')
      .split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(':').pop()), 0);
  } catch {
    walk.partialThen = 0;
  }
  if (walk.partialNow > walk.partialThen) {
    walk.violations.push({ where: JOURNAL, problem: `${walk.partialNow} lines replace a record in part, more than the ${walk.partialThen} of the baseline ${baseline}: prune the part a newer record takes` });
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
  for (const { where, problem } of casesTouchedUnclaimed(repoRoot, baseline)) walk.violations.push({ where, problem });
  for (const path of uncitedDocuments(repoRoot)) {
    if (git(repoRoot, 'ls-tree', '--name-only', baseline, '--', path).trim() !== '') {
      walk.violations.push({ where: path, problem: 'no record in force and no document of the work cites it: node scripts/drop-documents.mjs [QSWRK#baseline]' });
    }
  }
  return walk;
}

// A citation of the specification, `[QSNAM#scope]` or `[QSNAM]`, names a
// chapter under `docs/spec/` and a section it holds as a heading of its
// own, `## scope` [QSWRK#spec].
const SECTION_CITATION = /\[(QS[A-Z]{3})(?:#([a-z][a-z-]*))?\]/g;
export function unresolvedSections(repoRoot) {
  const specDir = join(repoRoot, 'docs', 'spec');
  const chapters = new Map((existsSync(specDir) ? readdirSync(specDir) : []).filter(name => /^QS[A-Z]{3}-.+\.md$/.test(name))
    .map(name => [name.slice(0, 5), new Set(readFileSync(join(specDir, name), 'utf8').split(/\r?\n/).filter(line => line.startsWith('## ')).map(line => line.slice(3).trim()))]));
  const citing = [...CITING_CODE_ROOTS.flatMap(root => filesUnder(repoRoot, root, CODE_FILE)), ...filesUnder(repoRoot, 'core/test/conformance', /\.jsonl$/),
    ...CITING_DOCUMENTS, ...filesUnder(repoRoot, JOURNAL, /\.md$/).filter(path => !path.includes('/replaced/') && !path.startsWith(`${RESEARCH}/`)), ...filesUnder(repoRoot, 'docs/spec', /\.md$/)];
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

// The records in transit, each with the sections it overrides: a record
// in force with a line `Overrides [QSNAM#scope], [QSNAM#reach]` [QSWRK#journal].
export function recordsInTransit(repoRoot) {
  const recordsDir = join(repoRoot, JOURNAL);
  return new Map(readdirSync(recordsDir).filter(name => /^[DE]\d+\.md$/.test(name)).flatMap(name => {
    const line = readFileSync(join(recordsDir, name), 'utf8').match(/^Overrides ((?:[^\r\n]|\r?\n(?=\[QS))+)/m)?.[1];
    return line === undefined ? [] : [[name.slice(0, -3), [...line.matchAll(/\[(QS[A-Z]{3}(?:#[a-z][a-z-]*)?)\]/g)].map(match => match[1])]];
  }));
}

// The records dissolved since the baseline, each with the sections it
// dissolved into and its file: those the baseline's tree held outside
// `replaced/`, or lacked, whose move into the sections the merge that
// lands them seals [QSWRK#baseline].
function dissolvedSince(repoRoot, baseline) {
  const replacedThen = new Set(git(repoRoot, 'ls-tree', '-r', '--name-only', baseline, '--', 'docs/').split('\n')
    .filter(path => path.includes('/replaced/')).map(path => RECORD_FILE.exec(path)?.[1]).filter(Boolean));
  return new Map([...readDecisionRecords(repoRoot)]
    .filter(([name, record]) => record.dissolvedInto.length > 0 && !replacedThen.has(name))
    .map(([name, record]) => [name, { sections: record.dissolvedInto, path: record.path }]));
}

// The cases of a chapter that the baseline's chapter held otherwise, or
// lacked, or that are gone from it, each claimed by a record in transit
// over its section: a case added or rewritten names the record, and a
// case taken away is named in the record's text; a record dissolved into
// the section since the baseline claims them until the merge that lands
// it; and a case under a
// chapter names no record but one in transit over its section [QSWRK#cases].
// A chapter the baseline did not hold is the work of the move that wrote
// it, read from the next baseline on.
export function casesTouchedUnclaimed(repoRoot, baseline) {
  const conformance = 'core/test/conformance';
  const transit = recordsInTransit(repoRoot);
  const covers = (sections, chapter, section) => sections.some(cited => cited === chapter || cited === `${chapter}#${section}`);
  const overrides = (record, chapter, section) => covers(transit.get(record) ?? [], chapter, section);
  const dissolved = [...dissolvedSince(repoRoot, baseline).values()];
  const dissolvedOver = (chapter, section) => dissolved.filter(({ sections }) => covers(sections, chapter, section));
  const casesOf = text => new Map(text.split(/\r?\n/).filter(line => line.trim() !== '' && !line.startsWith('//')).map(line => JSON.parse(line)).map(test => [test.name, test]));
  const unclaimed = [];
  for (const file of filesUnder(repoRoot, conformance, /\.jsonl$/).filter(path => /\/QS[A-Z]{3}\/[^/]+\.jsonl$/.test(path))) {
    const [chapter, section] = file.split('/').slice(-2).map(part => part.replace(/\.jsonl$/, ''));
    const now = casesOf(readFileSync(join(repoRoot, file), 'utf8'));
    const chapterThen = git(repoRoot, 'ls-tree', '--name-only', baseline, '--', `${conformance}/${chapter}/`).trim() !== '';
    let then = null;
    if (chapterThen) {
      try {
        then = casesOf(git(repoRoot, 'show', `${baseline}:${file}`));
      } catch {
        then = new Map();
      }
    }
    for (const [name, test] of now) {
      if (test.decision !== undefined && !overrides(test.decision, chapter, section)) unclaimed.push({ where: `${file}#${name}`, problem: `names ${test.decision}, which overrides no section ${chapter}#${section}` });
      if (then === null) continue;
      const before = then.get(name);
      const touched = before === undefined || before.query !== test.query || before.expect !== test.expect || before.target !== test.target || before.now !== test.now;
      if (touched && test.decision === undefined && dissolvedOver(chapter, section).length === 0) unclaimed.push({ where: `${file}#${name}`, problem: `changed since the baseline ${baseline}, and names no record in transit over ${chapter}#${section}, nor did one dissolve into it since` });
    }
    for (const name of then === null ? [] : [...then.keys()].filter(name => !now.has(name))) {
      const claimed = [...transit.keys()].some(record => overrides(record, chapter, section) && readFileSync(join(repoRoot, JOURNAL, `${record}.md`), 'utf8').includes(name))
        || dissolvedOver(chapter, section).some(({ path }) => readFileSync(path, 'utf8').includes(name));
      if (!claimed) unclaimed.push({ where: `${file}#${name}`, problem: `gone since the baseline ${baseline}, and no record in transit over ${chapter}#${section} names it, nor one dissolved into it since` });
    }
  }
  return unclaimed;
}

// The documents of the research that stay while something in force cites
// them [QSWRK#baseline]. A review is a unit of its own; a folder of any other
// research, a design with its runs, is one unit, held by a citation of any
// of it. The outside audits are a series the next one is read against, and
// the ledger of a folder, its README, lists what the folder holds and holds
// none of it.
const RESEARCH_DOCUMENT = new RegExp(`^${RESEARCH}/(?!outside-audit/)[^/]+/.+`);
const REPORTS = new RegExp(`^${RESEARCH}/reviews/`);
export const isReadme = path => /(^|\/)README\.md$/.test(path);

// The texts in force that may cite a document: the records in force and
// the documents of the work.
export function textsInForce(repoRoot) {
  const records = readdirSync(join(repoRoot, JOURNAL)).filter(name => /^[DE]\d+\.md$/.test(name)).map(name => `${JOURNAL}/${name}`);
  return [...records, ...CITING_DOCUMENTS].filter(path => existsSync(join(repoRoot, path))).map(path => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
}

// unitOf(path) → what a citation must name to hold the document: a
// review by its folder and name, `reviews/2026-10-10-vec-set-map.md`, any
// other research by its folder, `research/legend/`.
export const unitOf = path => (REPORTS.test(path) ? path.split('/').slice(-2).join('/') : `${path.slice(JOURNAL.length + 1).split('/').slice(0, 2).join('/')}/`);

// uncitedDocuments(repoRoot) → the documents of the research nothing in
// force cites.
export function uncitedDocuments(repoRoot) {
  const texts = textsInForce(repoRoot);
  return git(repoRoot, 'ls-files', RESEARCH).split('\n')
    .filter(path => RESEARCH_DOCUMENT.test(path) && !isReadme(path))
    .filter(path => !texts.some(({ text }) => text.includes(unitOf(path))));
}

// The walk of the baseline [QSWRK#baseline], [QSWRK#journal], read once for
// the conventions, which fail on what it finds, and for the screen of the
// work, which shows it. The baseline is the last commit that landed a
// branch on master. A record of the language that the baseline's tree holds is
// held by a case or closed by the line of its fate; the records written
// since wait for the walk, twenty at most; the code, the tests and
// the cases cite the records in force, the documents that hold the work
// those in force or waiting on a target; and a chapter is written at the
// move alone [QSWRK#spec].

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readDecisionRecords, replacedWhole, isBeingDecided, isHeld, JOURNAL, RESEARCH } from './decision-records.mjs';

export const RECORDS_A_WALK_TAKES = 20;
export const CITING_CODE_ROOTS = ['core/src', 'core/host', 'core/lib', 'core/test/unit', 'core/test/helpers', 'core/test/qlang', 'cli/src', 'cli/lib', 'cli/test', 'lsp/src', 'lsp/test', 'vscode/src', 'site/src', 'site/scripts', 'site/test', 'core/scripts', 'scripts', '.github/workflows'];
// The code beside the roots: the configurations at the root of the
// repository and of each workspace.
export const CITING_CODE_FILES = ['eslint.config.mjs', 'core/vitest.config.mjs', 'cli/vitest.config.mjs', 'cli/vitest.integration.config.mjs', 'lsp/vitest.config.mjs', 'site/astro.config.mjs', 'site/vitest.config.mjs'];
export const CITING_DOCUMENTS = ['CLAUDE.md', 'README.md', 'core/README.md', 'cli/README.md'];
export const CODE_FILE = /\.(mjs|js|ts|astro|peggy|qlang|yml)$/;
const UNCITING_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets']);
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

// citingCodeOf(repoRoot) → the files of code that cite, those under the roots
// and those beside them the tree holds; isCitingCode(path) whether a path is one.
export const citingCodeOf = repoRoot => [...CITING_CODE_ROOTS.flatMap(root => filesUnder(repoRoot, root, CODE_FILE)), ...CITING_CODE_FILES.filter(path => existsSync(join(repoRoot, path)))];
export const isCitingCode = path => CITING_CODE_FILES.includes(path) || (CODE_FILE.test(path) && CITING_CODE_ROOTS.some(root => path.startsWith(`${root}/`)));

export function citationsIn(text) {
  const cited = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(CITATION)) {
      for (const name of (match[1] ?? match[2]).split(/,\s*| and /)) cited.push({ name, line: index + 1 });
    }
  });
  return cited;
}

// A citation of a record, `[Dnn]`, or of a section by the code of its
// chapter and its heading, and a run of them, joined by commas and an `and`
// across the lines it wraps over.
const CITED = String.raw`\[(?:[DE]\d+|QS[A-Z]{3}(?:#[a-z][a-z-]*)?)\]`;
const RUN_OF_CITATIONS = new RegExp(`${CITED}(?:(?:,\\s*|,?\\s+and\\s+)${CITED})+`, 'g');
const byRecord = (left, right) => left[0].localeCompare(right[0]) || Number(left.slice(1)) - Number(right.slice(1));

// citedOnce(text, cited) → the text with each run that cites `cited` naming
// each record and section once, a section where it first stands and the
// records in their order in the places they hold, its separators kept where
// they stand, a line break before any other: the run a merge or a
// dissolution writes [QSWRK#journal], [QSWRK#baseline].
export function citedOnce(text, cited) {
  return text.replace(RUN_OF_CITATIONS, run => {
    if (!run.includes(`[${cited}]`)) return run;
    const named = [...new Set(run.match(new RegExp(CITED, 'g')).map(citation => citation.slice(1, -1)))];
    const records = named.filter(name => !name.startsWith('QS')).sort(byRecord);
    const names = named.map(name => (name.startsWith('QS') ? name : records.shift()));
    const separators = run.split(new RegExp(CITED)).slice(1, -1);
    while (separators.length > names.length - 1) {
      const plain = separators.findIndex((separator, index) => !separator.includes('\n') && !(index === separators.length - 1 && separator.includes('and')));
      separators.splice(plain !== -1 ? plain : Math.max(separators.findIndex(separator => !separator.includes('\n')), 0), 1);
    }
    return names.map((name, index) => `${index === 0 ? '' : separators[index - 1]}[${name}]`).join('');
  });
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

// walkOfBaseline(repoRoot) → { baseline, since, violations }: the baseline,
// the records written since it and every breach of the walk, each
// `{ where, problem }`.
export function walkOfBaseline(repoRoot) {
  const baseline = baselineOf(repoRoot);
  const walk = { baseline, since: [], violations: [] };
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
  for (const name of recordsInTransitAt(repoRoot, baseline)) walk.violations.push({ where: `${JOURNAL}/${name}.md`, problem: `in transit at the merge ${baseline} that landed it: dissolve it into its sections or set it aside before the merge` });
  walk.since = [...records.keys()].filter(name => !atBaseline.has(name));
  if (walk.since.length > RECORDS_A_WALK_TAKES) {
    walk.violations.push({ where: JOURNAL, problem: `${walk.since.length} records since the baseline ${baseline}, from ${walk.since[0]}: the walk is due` });
  }
  const notClosed = record => !replacedWhole(record) && !isBeingDecided(record);
  for (const file of citingCodeOf(repoRoot)) {
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
  // A seed is a text that states what holds, read first by every session:
  // it cites the sections a record in transit overrides and never the
  // record, which the journal keeps [QSWRK#documents].
  const transit = recordsInTransit(repoRoot);
  for (const file of CITING_DOCUMENTS.filter(path => existsSync(join(repoRoot, path)))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !notClosed(record) && !record.open) walk.violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
      else if (transit.has(name)) walk.violations.push({ where: `${file}:${line}`, problem: `cites ${name}, a record in transit: a seed cites the sections it overrides, ${transit.get(name).map(section => `[${section}]`).join(', ')}` });
    }
  }
  for (const { where, problem } of unresolvedSections(repoRoot)) walk.violations.push({ where, problem });
  for (const { where, problem } of casesTouchedUnclaimed(repoRoot, baseline)) walk.violations.push({ where, problem });
  for (const { where, problem } of sectionsWrittenUnclaimed(repoRoot, baseline)) walk.violations.push({ where, problem });
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
  const citing = [...citingCodeOf(repoRoot), ...filesUnder(repoRoot, 'core/test/conformance', /\.jsonl$/),
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
  return new Map(readdirSync(recordsDir).filter(name => /^D\d+\.md$/.test(name)).flatMap(name => {
    const line = readFileSync(join(recordsDir, name), 'utf8').match(/^Overrides ((?:[^\r\n]|\r?\n(?=\[QS))+)/m)?.[1];
    return line === undefined ? [] : [[name.slice(0, -3), [...line.matchAll(/\[(QS[A-Z]{3}(?:#[a-z][a-z-]*)?)\]/g)].map(match => match[1])]];
  }));
}

// The records in transit in the tree of a commit, those of its journal
// that override a section [QSWRK#baseline]; `git grep` ends with 1 where
// none does.
export function recordsInTransitAt(repoRoot, commit) {
  try {
    return git(repoRoot, 'grep', '-l', '-E', '^Overrides ', commit, '--', `${JOURNAL}/D*.md`, `${JOURNAL}/E*.md`).split('\n').filter(Boolean)
      .map(found => found.slice(found.lastIndexOf('/') + 1, -'.md'.length));
  } catch (failed) {
    if (failed.status === 1) return [];
    throw failed;
  }
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

// The text of the chapters since the baseline, section by section: a
// section the baseline's chapter held otherwise, or lacked, is one a record
// dissolved into since the baseline, a section or a chapter gone is named
// by one, and the head of a chapter goes with any record dissolved into
// it, so a chapter is written at the move, where its records dissolve [QSWRK#spec].
export function sectionsWrittenUnclaimed(repoRoot, baseline) {
  const dissolved = [...dissolvedSince(repoRoot, baseline).values()];
  const into = (chapter, section) => dissolved.some(({ sections }) => sections.some(cited => cited === chapter || cited === `${chapter}#${section}` || (section === '' && cited.startsWith(`${chapter}#`))));
  const naming = name => dissolved.some(({ path }) => readFileSync(path, 'utf8').includes(name));
  const chapterFile = /^QS[A-Z]{3}-.+\.md$/;
  const now = new Map(filesUnder(repoRoot, 'docs/spec', chapterFile).map(path => [path, readFileSync(join(repoRoot, path), 'utf8')]));
  const then = new Map(git(repoRoot, 'ls-tree', '--name-only', baseline, '--', 'docs/spec/').split('\n')
    .filter(path => chapterFile.test(path.split('/').pop())).map(path => [path, git(repoRoot, 'show', `${baseline}:${path}`)]));
  const unclaimed = [];
  for (const path of new Set([...now.keys(), ...then.keys()])) {
    const chapter = path.split('/').pop().slice(0, 5);
    if (!now.has(path)) {
      if (!naming(chapter)) unclaimed.push({ where: path, problem: `gone since the baseline ${baseline}, and no record dissolved since names it: a chapter is written at the move [QSWRK#spec]` });
      continue;
    }
    const sectionsNow = sectionsOfChapter(now.get(path));
    const sectionsThen = then.has(path) ? sectionsOfChapter(then.get(path)) : new Map();
    for (const section of new Set([...sectionsNow.keys(), ...sectionsThen.keys()])) {
      if (sectionsNow.get(section) === sectionsThen.get(section)) continue;
      const cited = section === '' ? chapter : `${chapter}#${section}`;
      if (into(chapter, section) || (!sectionsNow.has(section) && naming(cited))) continue;
      unclaimed.push({ where: section === '' ? path : `${path}#${section}`, problem: `written since the baseline ${baseline}, and no record dissolved into ${cited} since: a chapter is written at the move, where its records dissolve [QSWRK#spec]` });
    }
  }
  return unclaimed;
}

// The text of a chapter by its sections, the head before the first of
// them under the empty name.
function sectionsOfChapter(text) {
  const sections = new Map([['', []]]);
  let current = '';
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('## ')) sections.set(current = line.slice(3).trim(), []);
    else sections.get(current).push(line);
  }
  return new Map([...sections].map(([name, lines]) => [name, lines.join('\n').trim()]));
}

// The documents of the research that stay while something in force holds
// them [QSWRK#baseline]. A report a record called for, a critique of an open
// record, a review of the work a record did, an outside audit or a check of
// the chapters, is named after that record and numbered in the order it
// ran, as the runs of the benchmark are, `design-check/D329~2.md`,
// `reviews/D324~3.md`, `outside-audit/D327~1.md` and the folder of the
// readers of a check, `spec-check/D323~1/`, and stands with the session's
// reading beside it, `D329~2~reading.md` or the `reading.md` of the folder,
// the two one unit held while that record is in force or a text in force
// cites it. A review of a branch, which no record called for,
// `reviews/2026-10-13-the-path-is-a-value.md`, the fate of each finding below
// it, is a unit a text in force holds by citing it; a folder of any other
// research, a design with its runs, is one unit, held by a citation of any
// of it [QSWRK#review], and the README of a folder says what the folder holds
// and holds none of it.
const RESEARCH_DOCUMENT = new RegExp(`^${RESEARCH}/[^/]+/.+`);
const REPORTS = new RegExp(`^${RESEARCH}/reviews/`);
const OF_A_RECORD = new RegExp(`^${RESEARCH}/(?:(?:design-check|reviews|outside-audit)/(D\\d+)~\\d+(?=(?:~reading)?\\.md$)|spec-check/(D\\d+)~\\d+(?=/))`);
export const isReadme = path => /(^|\/)README\.md$/.test(path);

// recordHolding(repoRoot, path) → the record in force a report is named
// after, which holds it, or null.
export function recordHolding(repoRoot, path) {
  const match = OF_A_RECORD.exec(path);
  const name = match?.[1] ?? match?.[2];
  return name !== undefined && existsSync(join(repoRoot, JOURNAL, `${name}.md`)) ? name : null;
}

// The texts in force that may cite a document: the records in force and
// the documents of the work.
export function textsInForce(repoRoot) {
  const records = readdirSync(join(repoRoot, JOURNAL)).filter(name => /^D\d+\.md$/.test(name)).map(name => `${JOURNAL}/${name}`);
  return [...records, ...CITING_DOCUMENTS].filter(path => existsSync(join(repoRoot, path))).map(path => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
}

// unitOf(path) → what a citation must name to hold the document: a report
// a record called for by its folder and the name it shares with its
// reading, `design-check/D329~2` or `spec-check/D323~1`, a review of a
// branch by its folder and name,
// `reviews/2026-10-13-the-path-is-a-value.md`, and any other research by
// its folder, `research/<folder>/`.
export const unitOf = path => {
  const named = OF_A_RECORD.exec(path);
  if (named !== null) return named[0].split('/').slice(-2).join('/');
  return REPORTS.test(path) ? path.split('/').slice(-2).join('/') : `${path.slice(JOURNAL.length + 1).split('/').slice(0, 2).join('/')}/`;
};

// uncitedDocuments(repoRoot) → the documents of the research nothing in
// force holds: no critique whose record is in force and nothing a text in
// force cites.
export function uncitedDocuments(repoRoot) {
  const texts = textsInForce(repoRoot);
  return git(repoRoot, 'ls-files', RESEARCH).split('\n')
    .filter(path => RESEARCH_DOCUMENT.test(path) && !isReadme(path))
    .filter(path => recordHolding(repoRoot, path) === null)
    .filter(path => !texts.some(({ text }) => text.includes(unitOf(path))));
}

// reportsWithoutReading(repoRoot) → each report of the research that stands
// without the session's reading beside it [QSWRK#review]: a report a record
// called for, `design-check/D329~2.md` without `D329~2~reading.md`, and a
// run of the check of the chapters without its `reading.md`.
export function reportsWithoutReading(repoRoot) {
  const tracked = new Set(git(repoRoot, 'ls-files', RESEARCH).split('\n').filter(Boolean));
  const missing = [];
  for (const path of tracked) {
    const ofARecord = /^(.+\/(?:design-check|reviews|outside-audit)\/D\d+~\d+)\.md$/.exec(path);
    if (ofARecord !== null && !tracked.has(`${ofARecord[1]}~reading.md`)) missing.push({ path, reading: `${ofARecord[1]}~reading.md` });
  }
  const runs = new Set([...tracked].map(path => /^(.+\/spec-check\/[^/]+)\//.exec(path)?.[1]).filter(Boolean));
  for (const run of runs) if (!tracked.has(`${run}/reading.md`)) missing.push({ path: `${run}/`, reading: `${run}/reading.md` });
  return missing;
}

// The series of the benchmark, a run after a run, are its sets with their
// runs and its screens, a member what its paths share, a folder or a file:
// a branch keeps every run of its own, and the move of the baseline gives
// the older to the history, so the merge that lands a branch holds the two
// latest of each, while a report of the research leaves by what holds it,
// above [D354].
const SERIES = [
  { name: 'the sets of the benchmark', memberOf: path => /^scripts\/benchmark\/sets\/[^/]+\//.exec(path)?.[0] },
  { name: 'the screens of the benchmark', memberOf: path => /^scripts\/benchmark\/screens\/[^/]+$/.exec(path)?.[0] },
];

// seriesPastTheirTwoLatest(repoRoot, revision) → each series that holds
// more than its two latest in the tree of `revision`, or in the index where
// none is named, `{ name, count, older }`, `older` the members past the two
// latest, each `{ member, paths }`, a member dated by the commit that
// brought it and one no commit brought the latest.
export function seriesPastTheirTwoLatest(repoRoot, revision) {
  const paths = (revision === undefined ? git(repoRoot, 'ls-files') : git(repoRoot, 'ls-tree', '-r', '--name-only', revision)).split('\n').filter(Boolean);
  const broughtAt = member => Number(git(repoRoot, 'log', '--no-renames', '--diff-filter=A', '--format=%ct', revision ?? 'HEAD', '--', member.endsWith('/') ? member : `${member}*`).trim().split('\n').at(-1) || Infinity);
  return SERIES.flatMap(({ name, memberOf }) => {
    const members = new Map();
    for (const path of paths) {
      const member = memberOf(path);
      if (member !== undefined) members.set(member, [...(members.get(member) ?? []), path]);
    }
    if (members.size <= 2) return [];
    const at = new Map([...members.keys()].map(member => [member, broughtAt(member)]));
    const byTime = [...members.keys()].sort((left, right) => at.get(left) - at.get(right));
    return [{ name, count: members.size, older: byTime.slice(0, -2).map(member => ({ member, paths: members.get(member) })) }];
  });
}

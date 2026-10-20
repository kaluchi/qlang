#!/usr/bin/env node
// Mechanise the rules of the work that a pass over the tree can hold
// [QSWRK#tooling]: the checks catch the
// plain breaches, so a review reads for the deep ones, the habits words
// wake, the completeness of a concept, a half measure.
//
// Checks:
//
//   (1) Forbidden temporal framing / placeholder markers.
//       `TODO`, `FIXME`, `HACK`, `legacy`, `deprecated`,
//       `currently`, `previously`, `for backward compatibility`,
//       `backwards compat`, in the .mjs, .js, .md, .qlang, .peggy,
//       .astro and .yml texts outside `docs/` and the folders
//       `IGNORE_DIRS` names, the instruction file and this one aside.
//
//   (2) A refusal is declared by its address. Every factory of a
//       refusal and every recording of a site takes the address as a
//       literal, `'noun/LastNameError'`, and the constant that holds
//       the class is the address without its slash, across `core/src`,
//       `cli/src`, `lsp/src` [QSERR#site].
//
//   (3) Derivable tallies in markdown prose. A count that
//       `npm test`, the manifest, or a grep already answers —
//       the cases of the conformance suite, the tests, the
//       primitives, the files — is false the moment the next commit
//       lands. Prose states the invariant, the generator states
//       the number. Scanned outside fenced blocks and inline
//       code spans so example values stay legal.
//
//   (4) Internal workspace dependency ranges. npm workspaces link
//       a sibling by name, so a stale range steers nothing locally
//       and surfaces only in the registry, where a consumer
//       resolves it for real. Every declaration naming a sibling
//       workspace — in any dependency map — must read
//       `^<that workspace's version>`.
//
//   (5) Anchors of the texts that hold the work: a path the
//       instruction file, the aim or the chapter of
//       the work names exists, and words they
//       quote from the tree, “…” beside the path of their file, stand
//       in that file. A path under a folder the repository lacks is the
//       sister project's, checked where its checkout sits beside this
//       one.
//
//   (6) Decisions kept out of the catalog: a source of the catalog
//       names a record in the comment at its head alone [QSWRK#marks].
//
//   (7) Who decided: a record from D155 on names in a line of its
//       own, `Decided by.`, the maintainer or the model [QSWRK#journal].
//
//   (8) The folders of the records: the root of the journal holds the
//       records in force, and `replaced/` those replaced whole
//       [QSWRK#journal].
//
//   (9) The walk of a baseline: a record of the language the
//       baseline holds is held by a case or closed by the line of its
//       fate, no more than twenty records wait for the next walk, and the code, the tests and the cases cite the records in
//       force, the documents that hold the work those in force or
//       waiting on a target; a section of a chapter is
//       written since the baseline by a record dissolved into it [QSWRK#baseline].
//
//   (10) The links of the documents: a link of a document to a file of
//       markdown leads to a file the tree holds [QSWRK#journal].
//
//   (11) The fates of the records: a line of fate names a record the
//       journal holds, a part taken is named back by the record that
//       took it, and a record is pruned only by one written after it
//       [QSWRK#journal].
//
//   (12) A text that states what holds tells no history: a chapter
//       cites no record, tells no history of a form, says nothing of
//       what it leaves out, and but for the chapter of the work speaks
//       no word and no path of the journal [QSWRK#spec]; and no month
//       of the history stands in a chapter, a seed, a page of the
//       catalog, a case or the code [QSWRK#documents].
//
//   (13) The marks of the artifacts: every module, script, test file,
//       source of qlang and workflow names the rules it holds
//       [QSWRK#marks].
//
//   (14) A series of the benchmark keeps its two latest at the merge that
//       landed a branch: its sets and its screens, a branch keeping every
//       run of its own [QSWRK#baseline].
//
//   (15) A report of the research stands with the session's reading
//       beside it, every finding with its fate: a critique of an open
//       record, a review of the work a record did, a run of the check
//       of the chapters and an outside audit [QSWRK#review].
//
//   (16) A comment, a doc of the catalog and a sentence of the prose
//       that states what holds name no token the branch took out of the
//       code, the catalog and the cases, the name of what its reader
//       finds nowhere, but in a section a record in transit overrides
//       [QSWRK#documents].
//
//   (17) A text that states what holds writes no word the language
//       retired, `scripts/retired-words.mjs`: the prose of the chapters
//       and the seeds, the comments and docs of the code and the catalog,
//       the names of the cases and the titles of the tests [QSWRK#documents].
//
//   (18) No kind of the catalog bears the name of a command of a chain, one
//       the chain of a function or of a kind takes, the command named by its
//       act and what it writes by the noun of the thing [QSBLD#fn].
//
//   (19) The root of the package exports what a host builds on, a name a
//       workspace beside the core reads from the package or the page of the
//       package writes, by name from a module no other door opens
//       [QSWRK#tooling].
//
//   (20) A refusal names a kind after `Not` only as the label its subject
//       resides on or the kind a conversion of its address reads; any other
//       refusal of a kind is named by the role of its holder, the kinds
//       `:expected`: the refusals the code declares, read as (2) reads them,
//       and those the pages of the catalog write, read by the parser [D389].
//
// Exit 0 when every check passes, 1 when any violation surfaces.
// Run via `npm run check:conventions` from the repo root.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { readWorkspaces, siblingDeclarations } from './workspace-manifests.mjs';
import { codeOf, namesReadFrom, namesWrittenBy, unreadExports } from './root-exports.mjs';
import { baselineOf, isCitingCode, recordsInTransit, reportsWithoutReading, seriesPastTheirTwoLatest, walkOfBaseline, CITING_DOCUMENTS } from './baseline-walk.mjs';
import { marksOfTree } from './marks.mjs';
import { DECIDED_RECORD_FIELDS, OPEN_RECORD_FIELDS, foldersOfForm, isOpenText, readDecisionRecords, replacedWhole, statementsOf, JOURNAL, REPLACED, RESEARCH } from './decision-records.mjs';
import { RETIRED_WORDS } from './retired-words.mjs';
import { kindsNamedForCommands, kindsDeclaredBy } from './catalog-kinds.mjs';
import { kindsNamedOffTheirAddress, refusalsOfTheCatalog } from './refusal-kinds.mjs';
import { verdictOf } from './conventions-verdict.mjs';
import { execFileSync } from 'node:child_process';
import { readText, treeAt } from './tree-reads.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// ── (1) Forbidden temporal framing ─────────────────────────────

// Files and directory roots that are outside the review remit —
// generated code, vendored bundles, third-party modules, the doc
// tree (quotes CLAUDE.md rules verbatim and can name the forbidden
// words for pedagogy), and the ruleset files themselves.
const IGNORE_DIRS = new Set([
  'node_modules', '.git',
  'core/gen',
  'coverage',  // repo-root coverage/ from a top-level npm run test:coverage
  'cli/coverage', 'core/coverage', 'lsp/coverage', 'site/coverage',
  'site/dist', 'site/public',
  'scripts/benchmark/sets',  // the data and the generators clean authors wrote [QSWRK#measure]
  'vscode'
]);
// A review of a branch, named by its date, stands as its reviewer wrote it,
// and the README of its folder is checked [QSWRK#review].
const VERBATIM_REPORT = new RegExp(`^${RESEARCH}/reviews/\\d{4}-\\d{2}-\\d{2}[^/]*\\.md$`);
// Files that quote the forbidden list verbatim — exempt from the
// forbidden-word scan, still in scope for every other check.
const RULESET_FILES = new Set([
  'CLAUDE.md',
  'scripts/check-conventions.mjs'  // this file quotes the list
]);

const FORBIDDEN_REGEXES = [
  { rule: 'TODO marker',                 regex: /\bTODO\b/ },
  { rule: 'FIXME marker',                regex: /\bFIXME\b/ },
  { rule: 'HACK marker',                 regex: /\bHACK\b/ },
  { rule: 'temporal: "legacy"',          regex: /\blegacy\b/i },
  { rule: 'temporal: "deprecated"',      regex: /\bdeprecated\b/i },
  { rule: 'temporal: "currently"',       regex: /\bcurrently\b/i },
  { rule: 'temporal: "previously"',      regex: /\bpreviously\b/i },
  { rule: 'temporal: "backward compat"', regex: /backwards?[ -]compat/i },
  { rule: 'temporal: "for backward compatibility"',
    regex: /for backward compatibility/i }
];

// The sources a scan reads, the code, the pages and the texts, and those
// the words that tell when a text changed are sought in, the grammar, the
// pages of the site and the workflows among them [QSWRK#tooling].
const SOURCE_FILE = /\.(mjs|js|md|qlang)$/;
const TEXT_FILE = /\.(mjs|js|md|qlang|peggy|astro|yml)$/;

function* walkSourceTree(rootDir, sourceFile = SOURCE_FILE) {
  for (const entry of readdirSync(rootDir)) {
    const entryPath = join(rootDir, entry);
    const entryStat = statSync(entryPath);
    const relPath = relative(repoRoot, entryPath).split(sep).join('/');

    if (entryStat.isDirectory()) {
      if (IGNORE_DIRS.has(relPath) || IGNORE_DIRS.has(entry)) continue;
      // A directory with a `.git` of its own is another checkout, such
      // as the worktree an editor or an agent keeps inside the tree.
      if (existsSync(join(entryPath, '.git'))) continue;
      yield* walkSourceTree(entryPath, sourceFile);
      continue;
    }
    if (!sourceFile.test(entry) || VERBATIM_REPORT.test(relPath)) continue;
    yield entryPath;
  }
}

function scanForbiddenWords() {
  const violations = [];
  for (const filePath of walkSourceTree(repoRoot, TEXT_FILE)) {
    const text = readText(filePath);
    const lines = text.split(/\r?\n/);
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    // The docs/ tree names forbidden words for pedagogy, and the
    // ruleset files quote the list itself — both are allowed to
    // spell the words out.
    if (RULESET_FILES.has(relFile)) continue;
    if (relFile.startsWith('docs/')) continue;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const { rule, regex } of FORBIDDEN_REGEXES) {
        if (regex.test(line)) {
          violations.push({
            file: relFile,
            line: lineIndex + 1,
            rule,
            snippet: line.trim().slice(0, 120)
          });
        }
      }
    }
  }
  return violations;
}

// ── (2) A refusal is declared by its address ───────────────────
//
// A refusal's address is the one key the implementation and its page in the
// catalog share: every declaration of a refusal and every recording of an
// address outside one takes it as a literal, the path of the place that
// refused and a last name ending in `Error`, `vec/sum/ElementKindNotTakenError`,
// and the constant that holds the class is named by the address without its
// slashes, `VecSumElementKindNotTakenError`, so a grep for either finds the
// declaration, every throw and the page [QSERR#site]. A class declared by
// `class Foo extends …` ends in `Error`; the abstract roots are the bases
// every site extends.

const ABSTRACT_BASES = new Set(['QlangError', 'QlangDefect']);

const refusalDeclarationRe = /(?:\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*)?\b(declareRefusal|declareDefect|declare\w*Error|recordRefusal)\(\s*([^,)]*)/g;
const directClassRe = /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+(?:Qlang(?:Error|Defect)|Error)\b/g;
const ADDRESS_RE = /^'((?:[a-z][A-Za-z0-9]*\/)+[A-Z][A-Za-z0-9]*Error)'$/;
const FACTORY_DEFINITION_FILES = new Set(['core/src/errors.mjs']);

// The constant a refusal's class is held by: its address without the
// slash, each name capitalised.
function constantOfAddress(address) {
  return address.split('/').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

// Every workspace that can declare its own refusals goes through the
// same scan, the root of its sources named here.
const REFUSAL_SCAN_ROOTS = [
  ['core', 'src'],
  ['cli',  'src'],
  ['lsp',  'src']
];

function* walkRefusalScanRoots() {
  for (const segments of REFUSAL_SCAN_ROOTS) {
    const root = join(repoRoot, ...segments);
    let st;
    try { st = statSync(root); } catch { continue; }
    if (!st.isDirectory()) continue;
    yield* walkSourceTree(root);
  }
}

// The declarations of the refusals across the sources of the workspaces, each
// factory with its constant and its address and each class extending a root,
// read once for (2) and (20).
let declarationsRead;
function refusalDeclarations() {
  if (declarationsRead !== undefined) return declarationsRead;
  declarationsRead = { declarations: [], classes: [] };
  for (const filePath of walkRefusalScanRoots()) {
    const text = readText(filePath);
    const file = relative(repoRoot, filePath).split(sep).join('/');
    const lineAt = index => text.slice(0, index).split('\n').length;
    for (const match of text.matchAll(refusalDeclarationRe)) {
      const [, constant, factory, written] = match;
      const argument = written.trim();
      if (FACTORY_DEFINITION_FILES.has(file) && /^[a-z]\w*$/.test(argument)) continue;
      declarationsRead.declarations.push({ file, line: lineAt(match.index), constant, factory, argument, address: ADDRESS_RE.exec(argument)?.[1] });
    }
    for (const match of text.matchAll(directClassRe)) declarationsRead.classes.push({ file, line: lineAt(match.index), name: match[1] });
  }
  return declarationsRead;
}

function refusalsOffTheirAddress() {
  const { declarations, classes } = refusalDeclarations();
  const violations = [];
  for (const { file, line, constant, factory, argument, address } of declarations) {
    if (address === undefined) {
      violations.push({ file, line, problem: `${factory} takes ${argument || 'nothing'}, where a refusal's address stands, \`'noun/LastNameError'\`` });
    } else if (constant !== undefined && constant !== constantOfAddress(address)) {
      violations.push({ file, line, problem: `${constant} holds ${address}, which names it ${constantOfAddress(address)}` });
    }
  }
  for (const { file, line, name } of classes) {
    if (ABSTRACT_BASES.has(name) || name.endsWith('Error')) continue;
    violations.push({ file, line, problem: `class ${name} names a refusal without the suffix Error` });
  }
  return violations;
}

// ── (20) A refusal names a kind only where its address names it ─
//
// The refusals the code declares and those the pages of the catalog write,
// read against the kinds the catalog declares [D389].

function refusalsNamingKinds() {
  const declared = refusalDeclarations().declarations.filter(({ address }) => address !== undefined);
  const nouns = new Set([...kindsDeclaredBy(catalogSources())].map(name => name.toLowerCase()));
  return kindsNamedOffTheirAddress([...declared, ...refusalsOfTheCatalog(catalogSources())], nouns);
}

// ── (3) Derivable tallies in markdown prose ────────────────────
//
// The nouns whose counts a test run, the manifest, or a grep
// already answers. A digit standing in front of one of them in
// prose is a number the next commit invalidates in silence.

const TALLY_NOUNS = [
  'conformance', 'cases?', 'tests?', 'suites?', 'classes', 'workspaces?',
  'files?', 'entries', 'lines?', 'primitives?', 'catalogs?'
].join('|');

// Up to two adjectives may sit between the digit and the noun
// («1192 error-producing conformance cases»). A digit carrying a
// section sign (`§3 rule`, `#4 case`) addresses a chapter rather
// than counting one, and stays legal.
const TALLY_RE = new RegExp(
  String.raw`(?<![§#])\b\d[\d,]*\s+(?:[a-z][a-z-]*\s+){0,2}(?:` + TALLY_NOUNS + String.raw`)\b`,
  'i');

const FENCE_RE = /^\s*```/;
const INLINE_CODE_RE = /`[^`]*`/g;

// A report of the research stands as its outside reader wrote it
// [QSWRK#review], so the prose held to its tallies is the work's own, the
// session's reading of the report among it, by the forms of the folders of
// the research.
const OUTSIDE_REPORT = new RegExp(`^${RESEARCH}/(?:(?:${foldersOfForm('report')})/D\\d+~\\d+\\.md|(?:${foldersOfForm('run')})/D\\d+~\\d+/(?!reading\\.md)[^/]+\\.md)$`);

function scanProseTallies() {
  const violations = [];
  for (const filePath of walkSourceTree(repoRoot)) {
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    if (!relFile.endsWith('.md') || OUTSIDE_REPORT.test(relFile)) continue;

    const lines = readText(filePath).split(/\r?\n/);
    let insideFence = false;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (FENCE_RE.test(line)) {
        insideFence = !insideFence;
        continue;
      }
      if (insideFence) continue;

      const tally = line.replace(INLINE_CODE_RE, '').match(TALLY_RE);
      if (tally === null) continue;
      violations.push({
        file: relFile,
        line: lineIndex + 1,
        tally: tally[0].trim(),
        snippet: line.trim().slice(0, 120)
      });
    }
  }
  return violations;
}

// ── (4) Internal workspace dependency ranges ───────────────────
//
// `workspace-manifests.mjs` owns the rule: which dependency maps
// count and what range a sibling declaration carries. The release
// script rewrites against that module; this check enforces it, so a
// range off its sibling's version fails here rather than in the
// registry, where a consumer resolves it for real.

function rangesOffTheirSibling() {
  const violations = [];
  for (const declaration of siblingDeclarations(readWorkspaces(repoRoot))) {
    if (declaration.declaredRange === declaration.expectedRange) continue;
    violations.push({
      file: `${declaration.workspace.dir}/package.json`,
      dependencyMap: declaration.dependencyMap,
      depName: declaration.depName,
      declaredRange: declaration.declaredRange,
      expectedRange: declaration.expectedRange
    });
  }
  return violations;
}

// ── (5) Anchors of the texts that hold the work ────────────────

const ANCHOR_DOCUMENTS = ['CLAUDE.md', 'docs/journal/AIM.md', 'docs/spec/QSWRK-the-work.md'];
const ANCHOR_PATH_RE = /`((?:core|cli|lsp|site|vscode|scripts|docs|\.claude|\.github)\/[\w./@~-]+\.(?:mjs|js|qlang|peggy|md|json|jsonl|yml|astro|txt))`/g;
const TREE_QUOTE_RE = /“([^”]+)”\s*\(`([^`]+)`/g;
const sisterRoot = join(repoRoot, '..', 'eclipse-jdt-search');

// The checkout that holds a path: this one when its folder is here, the
// sister project's where it sits beside this one, and none otherwise.
function anchorRootOf(anchorPath) {
  const folder = anchorPath.split('/').slice(0, -1).join('/');
  if (existsSync(join(repoRoot, folder))) return repoRoot;
  return existsSync(sisterRoot) ? sisterRoot : null;
}

function anchorsTheTreeLacks() {
  const violations = [];
  for (const documentPath of ANCHOR_DOCUMENTS) {
    const text = readText(join(repoRoot, documentPath));
    for (const [, anchorPath] of text.matchAll(ANCHOR_PATH_RE)) {
      if (/\/(?:Dnn|En)\.md$/.test(anchorPath)) continue;
      const root = anchorRootOf(anchorPath);
      if (root !== null && !existsSync(join(root, anchorPath))) {
        violations.push({ file: documentPath, anchor: anchorPath, problem: 'names a file the tree lacks' });
      }
    }
    for (const [, quoted, anchorPath] of text.replace(/\s+/g, ' ').matchAll(TREE_QUOTE_RE)) {
      const root = anchorRootOf(anchorPath);
      if (root === null || !existsSync(join(root, anchorPath))) continue;
      const anchored = readText(join(root, anchorPath)).replace(/\s+/g, ' ');
      if (!anchored.includes(quoted.trim())) {
        violations.push({ file: documentPath, anchor: anchorPath, problem: `quotes “${quoted}”, which the file no longer holds` });
      }
    }
  }
  return violations;
}

// ── (6) Decisions kept out of the catalog ──────────────────────
//
// A page of the catalog is read by a reader of the language, which
// follows what the page names by a query; a decision of the process is
// no page of the language, so a reference to one is a link that leads
// nowhere, and the reason of a sentence lives with its decision [QSWRK#marks].

const CATALOG_ROOTS = ['core/lib', 'cli/lib'];

function catalogFiles(dir) {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? catalogFiles(join(dir, entry.name))
      : entry.name.endsWith('.qlang') ? [join(dir, entry.name)] : []);
}

// The comment at the head of a source, `|~ … ~|`, is no page a reader
// reads: it marks the rules the source holds [QSWRK#marks].
function decisionsInCatalog() {
  const violations = [];
  for (const file of CATALOG_ROOTS.flatMap(catalogFiles)) {
    const lines = readText(join(repoRoot, file)).split(/\r?\n/);
    const headEnd = lines[0]?.startsWith('|~') && !lines[0].startsWith('|~~') ? lines.findIndex(line => line.includes('~|')) : -1;
    lines.forEach((line, index) => {
      if (index <= headEnd) return;
      const reference = line.match(/\[D\d+\]/);
      if (reference) violations.push({ file: file.replace(/\\/g, '/'), line: index + 1, reference: reference[0] });
    });
  }
  return violations;
}

// ── (7) Who decided ────────────────────────────────────────────
//
// A record names who took its decision, so a session tells the
// maintainer's words, which bind it, from the model's reading, which it
// weighs on its merits; an open record names none until it is decided, and
// holds its question, its source and its alternatives [QSWRK#journal].

const FIRST_RECORD_NAMING_ITS_DECIDER = 155;
const DECIDER_LINE = /^Decided by\. The (maintainer|model)\b/m;
const holdsField = (text, field) => new RegExp(`^${field}\\. `, 'm').test(text);
const outOfForm = text => !holdsField(text, 'Domain') || (isOpenText(text)
  ? !OPEN_RECORD_FIELDS.every(field => holdsField(text, field)) || DECIDED_RECORD_FIELDS.some(field => holdsField(text, field))
  : !DECIDER_LINE.test(text));

function recordsWithoutDecider() {
  return [JOURNAL, REPLACED].flatMap(folder => readdirSync(join(repoRoot, folder))
    .map(file => ({ file: `${folder}/${file}`, number: Number(/^D(\d+)\.md$/.exec(file)?.[1]) }))
    .filter(({ number }) => number >= FIRST_RECORD_NAMING_ITS_DECIDER)
    .filter(({ file }) => outOfForm(readText(join(repoRoot, file))))
    .map(({ file }) => file));
}

// ── (8) The folders of the records ─────────────────────────────
//
// The root of the records holds those in force, and `replaced/` those
// replaced whole, each moved there once by `scripts/replaced-records.mjs`
// [QSWRK#journal].

function misplacedRecords() {
  const replacedWhole = path => /^(Replaced by|Merged into|Dissolved into|Filed under the (?:principles|tooling) by) /m.test(readText(join(repoRoot, path)));
  const inFolder = folder => readdirSync(join(repoRoot, folder)).filter(file => /^[DE]\d+\.md$/.test(file)).map(file => `${folder}/${file}`);
  return [
    ...inFolder(JOURNAL).filter(replacedWhole).map(path => ({ path, problem: 'is replaced whole: move it by `node scripts/replaced-records.mjs`' })),
    ...inFolder(REPLACED).filter(path => !replacedWhole(path)).map(path => ({ path, problem: 'is in force, and no record replaced it whole' }))
  ];
}

// ── (9) The walk of a baseline ─────────────────────────────────
//
// The baseline is the last commit that landed a branch on master. A record
// of the language that the baseline's tree holds is held by a case or closed
// by the line of its fate, and the records written since wait for the walk,
// twenty at most; the code, the tests and the
// cases cite the records in force, and the documents that hold the work
// those in force or waiting on a target [QSWRK#baseline].

function baselineUnwalked() {
  return walkOfBaseline(repoRoot).violations;
}

// ── (10) The links of the documents ────────────────────────────
//
// A link of a document to a file of markdown, its definition `[Dnn]:
// Dnn.md` or its inline form, leads to a file the tree holds, so the graph
// of the records walks from any document into the past [QSWRK#journal], [QSWRK#marks].

const MARKDOWN_LINK = /(?:\]:[ \t]*|\]\()([^)\s]+\.md)(?=[)\s#]|$)/gm;

function brokenLinks() {
  const violations = [];
  const documents = execFileSync('git', ['ls-files', '*.md'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const path of documents) {
    const text = readText(join(repoRoot, path));
    for (const match of text.matchAll(MARKDOWN_LINK)) {
      const target = match[1];
      if (/^[a-z]+:/i.test(target) || target.startsWith('/')) continue;
      if (existsSync(join(repoRoot, dirname(path), target))) continue;
      violations.push({ path, line: text.slice(0, match.index).split('\n').length, target });
    }
  }
  return violations;
}

// ── (11) The fates of the records ──────────────────────────────
//
// A line of fate names records the tree holds, a record that took a part
// written after the record it pruned, while a record closed whole names
// the records that carry it out, older ones among them; and a record in
// force a newer one says it took a part of names that record in its own
// line of fate, unless the newer one merged into it and gave the part
// back [QSWRK#journal].

// The records a clause of a fate names, those before what it says of them.
const namedIn = clause => [...clause.split(/,\s+(?:under which|whose|which)\b/)[0].matchAll(/\[([DE]\d+)\]/g)].map(match => match[1]);

function fatesOutOfStep() {
  const records = readDecisionRecords(repoRoot);
  const statementsOfRecord = new Map([...records].map(([name, record]) => [name, statementsOf(readText(record.path)).map(statement => statement.text)]));
  const fatesOf = name => statementsOfRecord.get(name).filter(statement => /^(Replaced by|Merged into|Pruned of what|Filed under the (?:principles|tooling) by) /.test(statement));
  const number = name => (name.startsWith('D') ? Number(name.slice(1)) : null);
  const violations = [];
  for (const name of records.keys()) {
    for (const fate of fatesOf(name)) {
      for (const taker of namedIn(fate)) {
        if (!records.has(taker)) violations.push({ name, problem: `names ${taker} in its fate, which has no record` });
        else if (fate.startsWith('Pruned of what') && number(name) !== null && number(taker) !== null && number(taker) < number(name)) violations.push({ name, problem: `says ${taker} took a part of it, written before it` });
      }
    }
    for (const statement of statementsOfRecord.get(name).filter(statement => statement.startsWith('Replaces '))) {
      const inPart = statement.startsWith('Replaces in part ') ? 0 : statement.search(/\band in part\b/);
      const whole = inPart === -1 ? statement : statement.slice(0, inPart);
      const part = inPart === -1 ? '' : statement.slice(inPart);
      for (const [clauses, isWhole] of [[whole, true], [part, false]]) {
        for (const taken of clauses.split(/;\s+/).flatMap(namedIn)) {
          const takenRecord = records.get(taken);
          if (takenRecord === undefined) violations.push({ name, problem: `says it took from ${taken}, which has no record` });
          else if (isWhole && !replacedWhole(takenRecord)) violations.push({ name, problem: `says it replaced ${taken} whole, which stands in force` });
          else if (!isWhole && !replacedWhole(takenRecord) && !fatesOf(taken).flatMap(namedIn).includes(name) && !records.get(name).mergedInto.includes(taken)) violations.push({ name, problem: `says it took a part of ${taken}, whose fate names it not` });
        }
      }
    }
  }
  return violations;
}

// ── (12) A text that states what holds tells no history ────────
//
// A chapter of the specification states what the language is: it cites
// no record of the journal, speaks none of the journal's words, tells no
// history of a form, and says nothing of what it leaves out [QSWRK#spec]. The
// prose is read outside its fenced blocks, whose probes may hold any text.
// The chapter of the work speaks the words and the paths of the journal,
// and no chapter cites a record [QSWRK#spec].
// A month written in a text that states what holds dates a story, which the
// history keeps [QSWRK#documents].
const HISTORY_DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
const SPEC_INTRUSIONS = [
  { rule: 'a record of the journal', regex: /\[[DE]\d+\]|\bdecisions? [DE]\d+\b/ },
  { rule: 'a record of the journal', regex: /docs\/journal/, besides: 'QSWRK' },
  { rule: 'a word of the journal', regex: /\b(journal|records? in (force|transit)|baselines?|dissolves?|dissolved|in transit|replaced\/)\b/i, besides: 'QSWRK' },
  { rule: 'the history of a form', regex: /\b(left|leaves|leave) the language\b|\bno longer\b|\bused to\b|\bformerly\b|\banymore\b/i },
  { rule: 'what the text leaves out', regex: /\bnothing else\b|\bno history\b/i },
  { rule: 'a date of the history', regex: HISTORY_DATE },
];
function specIntrusions() {
  const specDir = join(repoRoot, 'docs', 'spec');
  if (!existsSync(specDir)) return [];
  const found = [];
  for (const name of readdirSync(specDir).filter(file => file.endsWith('.md'))) {
    let fenced = false;
    readText(join(specDir, name)).split(/\r?\n/).forEach((line, index) => {
      if (line.startsWith('```')) { fenced = !fenced; return; }
      if (fenced) return;
      for (const { rule, regex, besides } of SPEC_INTRUSIONS) {
        if (besides !== undefined && name.startsWith(besides)) continue;
        const match = regex.exec(line);
        if (match) found.push({ file: `docs/spec/${name}`, line: index + 1, rule, text: match[0] });
      }
    });
  }
  const datedLines = path => readText(join(repoRoot, path)).split(/\r?\n/).forEach((line, index) => {
    const match = HISTORY_DATE.exec(line);
    if (match) found.push({ file: path, line: index + 1, rule: 'a date of the history', text: match[0] });
  });
  ['CLAUDE.md', 'README.md', 'core/README.md', 'cli/README.md'].forEach(datedLines);
  for (const [root, ending] of TEXTS_THAT_STATE) {
    readdirSync(join(repoRoot, root), { recursive: true }).map(String).filter(name => ending.test(name))
      .forEach(name => datedLines(`${root}/${name.split(sep).join('/')}`));
  }
  return found;
}

// Beside the chapters and the seeds, the catalog, the cases and the code
// state what holds [QSWRK#documents].
const TEXTS_THAT_STATE = [['core/lib', /\.qlang$/], ['cli/lib', /\.qlang$/], ['core/test/conformance', /\.jsonl$/],
  ['core/src', /\.(mjs|peggy)$/], ['cli/src', /\.mjs$/], ['lsp/src', /\.mjs$/]];

// ── (13) The marks of the artifacts ────────────────────────────
//
// Every module, script, test file, source of qlang and workflow names
// the rules it holds, so the scope of a record or a section is found by its
// marks and an artifact that names no rule it holds is seen [QSWRK#marks].

function unmarkedArtifacts() {
  return marksOfTree(repoRoot).orphans;
}

// ── (14) A series of the benchmark keeps its two latest at the baseline
//
// The sets of the benchmark with their runs and its screens keep their two
// latest at the merge that landed a branch, a branch keeping every run of
// its own and the move of the baseline giving the older to the history,
// `node scripts/drop-documents.mjs` [QSWRK#baseline].

function seriesBeyondTwo() {
  const baseline = baselineOf(repoRoot);
  return baseline === undefined ? [] : seriesPastTheirTwoLatest(repoRoot, baseline).map(series => ({ ...series, baseline }));
}

// ── (15) A report of the research stands with its reading ──────

function unreadReports() {
  return reportsWithoutReading(repoRoot);
}

// ── (16) A text names what its reader finds ────────────────────
//
// A text that states what holds is read by one who never saw the dialogue
// that wrote it, so a comment, a doc and a sentence of the prose name no
// token the branch took out of the code, the catalog and the cases since
// the baseline: a name the reader finds nowhere is a turn of that dialogue
// answering a past the reader never sees, which the record and the commit
// keep [QSWRK#documents]. A token is a name with a lowercase letter and a capital, a
// digit or an underscore inside it, or an address under `::`. A line of
// code holds what stands before its comment, a source of the catalog
// holds what stands outside its docs and comments, a case holds the whole
// line, and the prose of a chapter and of a seed names what stands outside
// its fenced blocks; a section a record in transit overrides waits for the
// move that writes it anew, as its probes wait [QSWRK#probe].

const UNREAD_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets']);
const TOKEN = /(?<![\\\w$])[A-Za-z_$][a-z$]*[A-Z0-9_][\w$]*\b|::[A-Za-z][\w/.-]*\w/g;
const tokensIn = text => [...text.matchAll(TOKEN)].map(match => match[0])
  .filter(token => token.length >= 3 && !/^[DE]\d+$/.test(token) && (token.startsWith('::') || /[a-z]/.test(token) || /[_\d]/.test(token)));

// What a file of the tree does with its lines: the prose names, a case
// holds, and the code and the catalog hold but in their comments and docs.
function voiceOfFile(path) {
  if (path.split('/').some(part => UNREAD_FOLDERS.has(part))) return null;
  if (CITING_DOCUMENTS.includes(path) || /^docs\/spec\/[^/]+\.md$/.test(path)) return 'prose';
  if (/^core\/test\/conformance\/.+\.jsonl$/.test(path)) return 'case';
  if (!isCitingCode(path)) return null;
  return path.endsWith('.qlang') ? 'catalog' : 'code';
}

// The lines of a text, each split into what it holds and what it names;
// a doc and a comment of the catalog run over lines, the longer marker
// read first, `|~~|` before `|~|` and `|~~` before `|~`, and a string of
// its code, `"…"` with its escapes as the grammar reads it, holds what it
// writes, a marker inside it among it.
function partsOfLines(voice, text) {
  const lines = text.split(/\r?\n/);
  if (voice === 'case') return lines.map(line => ({ holds: line, names: '' }));
  if (voice === 'prose') {
    let fenced = false;
    return lines.map(line => {
      if (line.startsWith('```')) fenced = !fenced;
      return { holds: '', names: fenced || line.startsWith('```') ? '' : line };
    });
  }
  if (voice === 'code') {
    return lines.map(line => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return { holds: '', names: line };
      const comment = line.indexOf(' // ');
      return comment === -1 ? { holds: line, names: '' } : { holds: line.slice(0, comment), names: line.slice(comment) };
    });
  }
  let inside = null;
  return lines.map(line => {
    let holds = '';
    let names = '';
    for (let at = 0; at < line.length;) {
      if (inside === '"') {
        const step = line[at] === '\\' ? 2 : 1;
        if (line[at] === '"') inside = null;
        holds += line.slice(at, at + step);
        at += step;
      } else if (inside !== null) {
        if (line.startsWith(inside, at)) { at += inside.length; inside = null; } else { names += line[at]; at += 1; }
      } else if (line[at] === '"') {
        inside = '"';
        holds += '"';
        at += 1;
      } else if (line.startsWith('|~~|', at) || line.startsWith('|~|', at)) {
        names += line.slice(at);
        break;
      } else if (line.startsWith('|~~', at)) { inside = '~~|'; at += 3; } else if (line.startsWith('|~', at)) { inside = '~|'; at += 2; } else { holds += line[at]; at += 1; }
    }
    return { holds, names };
  });
}

// The files of the checkout, tracked and untracked but not ignored, that a
// voice reads, listed once.
let speaking;
function filesThatSpeak() {
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 });
  speaking ??= [...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')]
    .filter(Boolean).filter(file => voiceOfFile(file) !== null && existsSync(join(repoRoot, file)));
  return speaking;
}

function namesOfTakenOut() {
  const baseline = baselineOf(repoRoot);
  if (baseline === undefined) return [];
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 });
  // The tokens the removed lines held, each line read in its file as the
  // baseline held it, so a doc or a comment it stood in is known.
  const removedLines = new Map();
  let path = null;
  let old = 0;
  for (const line of git('diff', '--no-color', '--no-ext-diff', '--no-renames', '-U0', baseline).split('\n')) {
    const hunk = /^@@ -(\d+)/.exec(line);
    if (line.startsWith('diff --git ')) path = null;
    else if (line.startsWith('--- a/')) path = line.slice(6);
    else if (hunk !== null) old = Number(hunk[1]);
    else if (line.startsWith('-') && !line.startsWith('--- ') && path !== null && voiceOfFile(path) !== null) {
      removedLines.set(path, [...(removedLines.get(path) ?? []), old]);
      old += 1;
    }
  }
  const removed = new Set();
  const textsThen = treeAt(repoRoot, baseline).textsOf([...removedLines.keys()]);
  for (const [file, numbers] of removedLines) {
    const parts = partsOfLines(voiceOfFile(file), textsThen.get(file));
    for (const number of numbers) for (const token of tokensIn(parts[number - 1]?.holds ?? '')) removed.add(token);
  }
  // The sections a record in transit overrides, whose text waits for the
  // move [QSWRK#spec].
  const waiting = new Set([...recordsInTransit(repoRoot).values()].flat());
  const files = filesThatSpeak();
  const held = new Set();
  const naming = [];
  for (const file of files) {
    const text = readText(join(repoRoot, file));
    const lines = text.split(/\r?\n/);
    const chapter = /^docs\/spec\/(QS[A-Z]{3})-/.exec(file)?.[1];
    let section = '';
    partsOfLines(voiceOfFile(file), text).forEach(({ holds, names }, index) => {
      const line = lines[index];
      if (chapter !== undefined && line.startsWith('## ')) section = line.slice(3).trim();
      for (const token of tokensIn(holds)) held.add(token);
      const waits = chapter !== undefined && (waiting.has(chapter) || waiting.has(`${chapter}#${section}`));
      if (names !== '' && !waits) naming.push({ file, line: index + 1, names, text: line.trim() });
    });
  }
  const isHeld = token => held.has(token) || (token.startsWith('::') && [...held].some(other => other.startsWith(`${token}/`)));
  const takenOut = new Set([...removed].filter(token => !isHeld(token)));
  return naming.flatMap(({ file, line, names, text }) => [...new Set(tokensIn(names))].filter(token => takenOut.has(token))
    .map(token => ({ file, line, token, baseline, snippet: text.slice(0, 120) })));
}

// ── (17) Retired words ─────────────────────────────────────────

// The title a test states its rule in, `it('…')`, a string its code holds.
const TEST_TITLE = /\b(?:it|test|describe)(?:\.\w+)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

const nameOfCase = line => {
  try { return JSON.parse(line).name ?? ''; } catch { return ''; }
};

// The words the language retired, read where a text states what holds:
// the prose, the comments and docs, the name of a case and the title of a
// test [QSWRK#documents].
function retiredWordsWritten() {
  const files = filesThatSpeak();
  // The sections a record in transit overrides, whose text waits for the
  // move [QSWRK#spec].
  const waiting = new Set([...recordsInTransit(repoRoot).values()].flat());
  const found = [];
  for (const file of files) {
    const voice = voiceOfFile(file);
    const isTest = /(^|\/)test\//.test(file);
    const text = readText(join(repoRoot, file));
    const lines = text.split(/\r?\n/);
    const chapter = /^docs\/spec\/(QS[A-Z]{3})-/.exec(file)?.[1];
    let section = '';
    partsOfLines(voice, text).forEach(({ holds, names }, index) => {
      if (chapter !== undefined && lines[index].startsWith('## ')) section = lines[index].slice(3).trim();
      if (chapter !== undefined && (waiting.has(chapter) || waiting.has(`${chapter}#${section}`))) return;
      const read = voice === 'case' ? [nameOfCase(holds)] : [names, ...(isTest ? [...holds.matchAll(TEST_TITLE)].map(match => match[2]) : [])];
      for (const part of read) {
        for (const { regex, written, by } of RETIRED_WORDS) {
          const word = regex.exec(part)?.[0];
          if (word !== undefined) found.push({ file, line: index + 1, word, written, by });
        }
      }
    });
  }
  return found;
}

// ── (18) Kinds named for commands ──────────────────────────────
//
// A command of a chain is named by its act and what it writes by the noun of
// the thing, so no kind of the catalog bears the name of a command [QSBLD#fn].

// The sources of the catalog, read once for (18) and (20).
let catalogRead;
const catalogSources = () => catalogRead ??= CATALOG_ROOTS.flatMap(catalogFiles).map(file => ({ path: file.replace(/\\/g, '/'), text: readText(join(repoRoot, file)) }));

function kindsOfCommands() {
  return kindsNamedForCommands(catalogSources());
}

// ── (19) The exports of the root of the package ────────────────
//
// The root of the core, its manifest's `.`, exports what the workspaces beside
// it read from the package by its name or its page, the README of the core,
// writes, each by name from a module no other door of the manifest opens
// [QSWRK#tooling].

function exportsNoHostReads() {
  const workspaces = readWorkspaces(repoRoot);
  const core = workspaces.find(({ dir }) => dir === 'core');
  const { name: packageName, exports: doors } = core.manifest;
  const rootPath = join(core.dir, doors['.'].import);
  const doorModules = new Set(Object.entries(doors)
    .filter(([door, target]) => door !== '.' && target.import !== undefined)
    .map(([, target]) => `./${relative(dirname(rootPath), join(core.dir, target.import)).split(sep).join('/')}`));
  const read = new Set();
  for (const { dir } of workspaces.filter(workspace => workspace !== core)) {
    const sources = execFileSync('git', ['ls-files', dir], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(path => /\.(?:mjs|js|astro)$/.test(path));
    for (const path of sources) namesReadFrom(packageName, codeOf(path, readText(join(repoRoot, path)))).forEach(name => read.add(name));
  }
  const written = namesWrittenBy(readText(join(repoRoot, core.dir, 'README.md')));
  return unreadExports({ rootText: readText(join(repoRoot, rootPath)), doorModules, read, written })
    .map(finding => ({ file: rootPath.split(sep).join('/'), ...finding }));
}

// ── Main ───────────────────────────────────────────────────────

const { text, failed } = verdictOf({
  forbidden: scanForbiddenWords(),
  refusalDeclarations: refusalsOffTheirAddress(),
  kindNames: refusalsNamingKinds(),
  proseTallies: scanProseTallies(),
  workspaceRanges: rangesOffTheirSibling(),
  anchors: anchorsTheTreeLacks(),
  catalogDecisions: decisionsInCatalog(),
  undecided: recordsWithoutDecider(),
  unmarked: unmarkedArtifacts(),
  misplaced: misplacedRecords(),
  broken: brokenLinks(),
  outOfStep: fatesOutOfStep(),
  unwalked: baselineUnwalked(),
  intrusions: specIntrusions(),
  swollen: seriesBeyondTwo(),
  unread: unreadReports(),
  takenOutNamed: namesOfTakenOut(),
  retired: retiredWordsWritten(),
  commandKinds: kindsOfCommands(),
  unreadExports: exportsNoHostReads()
});
process.stdout.write(text);
process.exit(failed ? 1 : 0);

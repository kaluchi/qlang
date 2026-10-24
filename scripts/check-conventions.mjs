#!/usr/bin/env node
// Mechanise the rules of the work that a pass over the tree can hold
// [QSGAT#gate]: the checks catch the
// plain breaches, so a review reads for the deep ones, the habits words
// wake, the completeness of a concept, a half measure.
//
// Checks:
//
//   (1) Forbidden temporal framing and the words of unfinished work.
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
//   (5) Anchors of the texts that hold the work: a path the seed, the
//       aim or a chapter names exists, and words they quote from the
//       tree, “…” beside the path of their file, stand in that file, a
//       section a record in transit overrides waiting for its closeout,
//       `scripts/anchors.mjs`. A path under a folder the repository lacks
//       is the sister project's, checked where its checkout sits beside
//       this one [QSREQ#probe].
//
//   (6) Decisions kept out of the catalog: a source of the catalog
//       names a record in the comment at its head alone [QSREQ#marks].
//
//   (7) Who decided: a record from D155 on names in a line of its
//       own, `Decided by.`, the maintainer or the model [QSWRK#journal].
//
//   (8) The folders of the records: the root of the journal holds the
//       records in force, and `replaced/` those replaced whole
//       [QSWRK#journal].
//
//   (9) The reconciliation of the tree with its baseline,
//       `scripts/reconciliation.mjs`: a record of the language the
//       baseline holds is held by a case or closed by the line of its
//       fate; the code, the tests and the cases cite the records in force,
//       the documents that hold the work those in force or waiting on a
//       target; a citation names a section the specification holds or
//       one a record in transit brings; and a section of a chapter is
//       written since the baseline by a record dissolved into it [QSWRK#reconciliation].
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
//       no word and no path of the journal [QSVOX#chapter]; and no month
//       of the history stands in a chapter, a seed, a page of the
//       catalog, a case or the code [QSVOX#pentimento].
//
//   (13) The marks of the artifacts: every module, script, test file,
//       source of qlang and workflow names the rules it holds
//       [QSREQ#marks].
//
//   (14) A series of the benchmark keeps its two latest at the merge that
//       landed a branch: its sets and its screens, a branch keeping every
//       run of its own [QSWRK#closeout].
//
//   (15) A report of the research stands with the session's reading
//       beside it, every finding with its fate: a critique of an open
//       record, a review of the work a record did, a run of the check
//       of the chapters and an outside audit [QSRVW#research].
//
//   (16) A comment, a doc of the catalog and a sentence of the prose
//       that states what holds name no token the branch took out of the
//       code, the catalog and the cases, the name of what its reader
//       finds nowhere, but in a section a record in transit overrides
//       [QSVOX#pentimento].
//
//   (17) A text that states what holds writes no word the language
//       retired, `scripts/retired-words.mjs`: the prose of the chapters
//       and the seeds, the comments and docs of the code and the catalog,
//       the names of the cases and the titles of the tests [QSLEX#term].
//
//   (18) No kind of the catalog bears the name of a command of a chain, one
//       the chain of a function or of a kind takes, the command named by its
//       act and what it writes by the noun of the thing [QSBLD#fn].
//
//   (19) The root of the package exports what a host builds on, a name a
//       workspace beside the core reads from the package or the page of the
//       package writes, by name from a module no other door opens
//       [QSGAT#workspaces].
//
//   (20) A refusal names a kind after `Not` only as the label its subject
//       resides on or the kind a conversion of its address reads; any other
//       refusal of a kind is named by the role of its holder, the kinds
//       `:expected`: the refusals the code declares, read as (2) reads them,
//       and those the pages of the catalog write, read by the parser [QSERR#site].
//
//   (21) A test file stands in the section whose rule its tests hold,
//       `<chapter>/<section>.test.mjs` under the tests of its workspace, or
//       at a record in force of a domain its tests hold, the title of a test
//       or of a group cites no rule and names no binding its file imports
//       from the code, and a group holds two tests or more in a file of two
//       groups or more; a section a record in transit brings is one a test
//       file stands at until its closeout [QSREQ#marks].
//
//   (22) A comment of the sources and the tests of the core, the command
//       line and the language server is a mark alone, one line of the
//       citations its block holds, or a directive of a tool [QSLEX#code].
//
//   (23) No two modules of the project, its `.mjs`, `.js`, `.qlang` and
//       `.peggy` files, bear one name, a test file and a configuration of
//       a tool aside by their form [QSLEX#grep].
//
// Exit 0 when every check passes, 1 when any violation surfaces.
// Run via `npm run check:conventions` from the repo root.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { readWorkspaces, siblingDeclarations } from './workspace-manifests.mjs';
import { codeOf, namesReadFrom, namesWrittenBy, unreadExports } from './root-exports.mjs';
import { baselineOf, citableOf, isCitingCode, reconciliationOf, recordsInTransit, reportsWithoutReading, seriesPastTheirTwoLatest, CITING_DOCUMENTS, WORK_CHAPTERS } from './reconciliation.mjs';
import { marksOfTree } from './marks.mjs';
import { DECIDED_RECORD_FIELDS, FATES_NAMING_A_RECORD, FATES_OUT_OF_FORCE, OPEN_RECORD_FIELDS, lineOfFate, foldersOfForm, isOpenText, readDecisionRecords, replacedWhole, statementsOf, JOURNAL, REPLACED, RESEARCH } from './decision-records.mjs';
import { RETIRED_WORDS } from './retired-words.mjs';
import { kindsNamedForCommands, kindsDeclaredBy } from './catalog-kinds.mjs';
import { kindsNamedOffTheirAddress, refusalsOfTheCatalog } from './refusal-kinds.mjs';
import { verdictOf } from './conventions-verdict.mjs';
import { execFileSync } from 'node:child_process';
import { readText, treeAt } from './tree-reads.mjs';
import { problemsOfTestFile, testFilesOfTree } from './test-homes.mjs';
import { anchorsTheTreeLacks } from './anchors.mjs';
import { namesSharedInTree } from './grep-ergonomics.mjs';
import { parse } from 'acorn';

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
  'scripts/benchmark/sets',  // the data and the generators clean authors wrote [QSMSR#benchmark]
  'vscode'
]);
// A review of a branch, named by its date, stands as its reviewer wrote it,
// and the README of its folder is checked [QSRVW#review].
const VERBATIM_REPORT = new RegExp(`^${RESEARCH}/reviews/\\d{4}-\\d{2}-\\d{2}[^/]*\\.md$`);
// Files that quote the forbidden list verbatim — exempt from the
// forbidden-word scan, still in scope for every other check.
const RULESET_FILES = new Set([
  'CLAUDE.md',
  'scripts/check-conventions.mjs'  // this file quotes the list
]);

const FORBIDDEN_REGEXES = [
  { rule: 'unfinished work: "TODO"',     regex: /\bTODO\b/ },
  { rule: 'unfinished work: "FIXME"',    regex: /\bFIXME\b/ },
  { rule: 'unfinished work: "HACK"',     regex: /\bHACK\b/ },
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
// pages of the site and the workflows among them [QSVOX#pentimento].
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

const REFUSAL_FACTORY = /^(?:declareRefusal|declareDefect|recordRefusal|declare\w*Error)$/;
const REFUSAL_ROOTS = new Set([...ABSTRACT_BASES, 'Error']);
const ADDRESS_RE = /^(?:[a-z][A-Za-z0-9]*\/)+[A-Z][A-Za-z0-9]*Error$/;
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
// read by the parser of JavaScript once for (2) and (20) [D434]: a call of a
// factory, the constant whose value it is, and its first argument, an
// address where it is a string the form of one; the factory's own module
// handing it a name passes.
let declarationsRead;
function refusalDeclarations() {
  if (declarationsRead !== undefined) return declarationsRead;
  declarationsRead = { declarations: [], classes: [] };
  for (const filePath of walkRefusalScanRoots()) {
    if (!/\.m?js$/.test(filePath)) continue;
    const text = readText(filePath);
    const file = relative(repoRoot, filePath).split(sep).join('/');
    const program = parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, locations: true });
    const constants = new Map();
    const calls = [];
    const visit = node => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init?.type === 'CallExpression') constants.set(node.init, node);
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && REFUSAL_FACTORY.test(node.callee.name)) calls.push(node);
      if (/^Class(?:Declaration|Expression)$/.test(node.type) && /^[A-Z]/.test(node.id?.name ?? '') && REFUSAL_ROOTS.has(node.superClass?.name)) {
        declarationsRead.classes.push({ file, line: node.loc.start.line, name: node.id.name });
      }
      for (const key in node) if (key !== 'loc') visit(node[key]);
    };
    visit(program);
    for (const call of calls) {
      const [first] = call.arguments;
      if (FACTORY_DEFINITION_FILES.has(file) && first?.type === 'Identifier') continue;
      const held = constants.get(call);
      const address = first?.type === 'Literal' && typeof first.value === 'string' && ADDRESS_RE.test(first.value) ? first.value : undefined;
      declarationsRead.declarations.push({ file, line: (held ?? call).loc.start.line, constant: held?.id.name, factory: call.callee.name, argument: first === undefined ? '' : text.slice(first.start, first.end), address });
    }
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
// read against the kinds the catalog declares [QSERR#site].

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
// [QSRVW#research], so the prose held to its tallies is the work's own, the
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
//
// A path the seed, the aim or a chapter names is a file, and words they quote
// beside it stand in it, `scripts/anchors.mjs` [QSREQ#probe], [QSVOX#chapter].

// ── (6) Decisions kept out of the catalog ──────────────────────
//
// A page of the catalog is read by a reader of the language, which
// follows what the page names by a query; a decision of the process is
// no page of the language, so a reference to one is a link that leads
// nowhere, and the reason of a sentence lives with its decision [QSREQ#marks].

const CATALOG_ROOTS = ['core/lib', 'cli/lib'];

function catalogFiles(dir) {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? catalogFiles(join(dir, entry.name))
      : entry.name.endsWith('.qlang') ? [join(dir, entry.name)] : []);
}

// The comment at the head of a source, `|~ … ~|`, is no page a reader
// reads: it marks the rules the source holds [QSREQ#marks].
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
  const replacedWhole = path => lineOfFate(FATES_OUT_OF_FORCE, 'm').test(readText(join(repoRoot, path)));
  const inFolder = folder => readdirSync(join(repoRoot, folder)).filter(file => /^[DE]\d+\.md$/.test(file)).map(file => `${folder}/${file}`);
  return [
    ...inFolder(JOURNAL).filter(replacedWhole).map(path => ({ path, problem: 'is replaced whole: move it by `node scripts/replaced-records.mjs`' })),
    ...inFolder(REPLACED).filter(path => !replacedWhole(path)).map(path => ({ path, problem: 'is in force, and no record replaced it whole' }))
  ];
}

// ── (9) The reconciliation of the tree with its baseline ───────
//
// The baseline is the last commit that landed a branch on master. A record
// of the language that the baseline's tree holds is held by a case or closed
// by the line of its fate; the code, the tests and the cases cite the records
// in force, and the documents that hold the work those in force or waiting
// on a target [QSWRK#reconciliation].

function baselineUnreconciled() {
  return reconciliationOf(repoRoot).violations;
}

// ── (10) The links of the documents ────────────────────────────
//
// A link of a document to a file of markdown, its definition `[Dnn]:
// Dnn.md` or its inline form, leads to a file the tree holds, so the graph
// of the records walks from any document into the past [QSWRK#journal], [QSREQ#marks].

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
  const fatesOf = name => statementsOfRecord.get(name).filter(statement => lineOfFate(FATES_NAMING_A_RECORD).test(statement));
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
// history of a form, and says nothing of what it leaves out [QSVOX#chapter]. The
// prose is read outside its fenced blocks, whose probes may hold any text.
// The chapters of the work speak the words and the paths of the journal,
// and no chapter cites a record [QSVOX#chapter].
// A month written in a text that states what holds dates a story, which the
// history keeps [QSVOX#pentimento].
const HISTORY_DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
const SPEC_INTRUSIONS = [
  { rule: 'a record of the journal', regex: /\[[DE]\d+\]|\bdecisions? [DE]\d+\b/ },
  { rule: 'a record of the journal', regex: /docs\/journal/, besides: WORK_CHAPTERS },
  { rule: 'a word of the journal', regex: /\b(journal|records? in (force|transit)|baselines?|dissolves?|dissolved|in transit|replaced\/)\b/i, besides: WORK_CHAPTERS },
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
        if (besides !== undefined && besides.includes(name.slice(0, 5))) continue;
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
// state what holds [QSVOX#voices].
const TEXTS_THAT_STATE = [['core/lib', /\.qlang$/], ['cli/lib', /\.qlang$/], ['core/test/conformance', /\.jsonl$/],
  ['core/src', /\.(mjs|peggy)$/], ['cli/src', /\.mjs$/], ['lsp/src', /\.mjs$/]];

// ── (13) The marks of the artifacts ────────────────────────────
//
// Every module, script, test file, source of qlang and workflow names
// the rules it holds, so the scope of a record or a section is found by its
// marks and an artifact that names no rule it holds is seen [QSREQ#marks].

function unmarkedArtifacts() {
  return marksOfTree(repoRoot).orphans;
}

// ── (14) A series of the benchmark keeps its two latest at the baseline
//
// The sets of the benchmark with their runs and its screens keep their two
// latest at the merge that landed a branch, a branch keeping every run of
// its own and the closeout giving the older to the history,
// `node scripts/drop-documents.mjs` [QSWRK#closeout].

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
// keep [QSVOX#pentimento]. A token is a name with a lowercase letter and a capital, a
// digit or an underscore inside it, or an address under `::`. A line of
// code holds what stands before its comment, a source of the catalog
// holds what stands outside its docs and comments, a case holds the whole
// line, and the prose of a chapter and of a seed names what stands outside
// its fenced blocks; a section a record in transit overrides waits for the
// move that writes it anew, as its probes wait [QSREQ#probe].

const UNREAD_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets']);
const TOKEN = /(?<![\\\w$])[A-Za-z_$][a-z$]*[A-Z0-9_][\w$]*\b|::[A-Za-z][\w/.-]*\w/g;
const KEYWORD = /(?<![:\w]):[A-Za-z][\w/.-]*\w/g;
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
// a doc and a comment of the catalog run over lines, the longer opener
// read first, `|~~|` before `|~|` and `|~~` before `|~`, and a string of
// its code, `"…"` with its escapes as the grammar reads it, holds what it
// writes, an opener inside it among it.
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
  // move [QSVOX#chapter].
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
      // A keyword holds the address of the name it names [QSNAM#address].
      for (const [keyword] of holds.matchAll(KEYWORD)) held.add(`:${keyword}`);
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
// test [QSLEX#term].
function retiredWordsWritten() {
  const files = filesThatSpeak();
  // The sections a record in transit overrides, whose text waits for the
  // move [QSVOX#chapter].
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
// [QSGAT#workspaces].

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

// ── (21) A test stands in the section of its rule ──────────────
//
// A test file stands in the section whose rule its tests hold, named by its
// path as a file of the cases is, or at the record in force of a domain whose
// tests hold it where no chapter states the rule, the title of a test cites
// no rule, which the path names, and its groups and its titles say its rules
// in the words of its section [QSREQ#marks].

function testsOffTheirSection() {
  const records = readDecisionRecords(repoRoot);
  // A section the specification holds, or one a record in transit brings,
  // where its test file stands until the closeout writes it [QSVOX#chapter].
  const citable = citableOf(repoRoot);
  const sections = { has: cited => citable(...cited.split('#')) };
  const heldByItsTests = name => {
    const record = records.get(name);
    return record !== undefined && !record.open && !replacedWhole(record) && !['language', 'process', 'benchmark'].includes(record.domain);
  };
  return testFilesOfTree(repoRoot).flatMap(({ path, text }) => problemsOfTestFile(path, text, { sections, heldByItsTests })
    .map(({ line, problem }) => ({ file: path, line, problem })));
}

// ── (22) A comment of the code is a mark ───────────────────────
//
// A comment of the sources and the tests of the core, the command line and
// the language server, read by acorn, is a mark alone, one line of the
// citations its block holds, or a directive of a tool [QSLEX#code].

const MARKED_SOURCES = ['core/src', 'core/host', 'core/test', 'cli/src', 'cli/test', 'lsp/src', 'lsp/test'];
const CITED = String.raw`\[(?:QS[A-Z]{3}(?:#[a-z-]+)?|D\d+)\]`;
const MARKS_ALONE = new RegExp(String.raw`^\s*${CITED}(?:,\s*${CITED})*\s*$`);
const TOOL_DIRECTIVE = /^\s*(?:eslint|global\s|@ts-|istanbul|c8\s|v8 ignore)/;

function commentsThatAreNoMarks() {
  const files = execFileSync('git', ['ls-files', ...MARKED_SOURCES.flatMap(dir => [`${dir}/*.mjs`, `${dir}/**/*.mjs`])], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  return files.flatMap(file => {
    const text = readText(join(repoRoot, file));
    const comments = [];
    parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, onComment: comments });
    return comments.filter(comment => !MARKS_ALONE.test(comment.value) && !TOOL_DIRECTIVE.test(comment.value))
      .map(comment => ({ file, line: text.slice(0, comment.start).split('\n').length, snippet: comment.value.trim().slice(0, 100) }));
  });
}

// ── (23) No two modules bear one name ──────────────────────────
//
// A module is found by its name: no two modules of the project bear one, a
// test file and a configuration of a tool aside by their form,
// `scripts/grep-ergonomics.mjs` [QSLEX#grep].

// ── Main ───────────────────────────────────────────────────────

const { text, failed } = verdictOf({
  forbidden: scanForbiddenWords(),
  refusalDeclarations: refusalsOffTheirAddress(),
  kindNames: refusalsNamingKinds(),
  proseTallies: scanProseTallies(),
  workspaceRanges: rangesOffTheirSibling(),
  anchors: anchorsTheTreeLacks(repoRoot),
  catalogDecisions: decisionsInCatalog(),
  undecided: recordsWithoutDecider(),
  unmarked: unmarkedArtifacts(),
  misplaced: misplacedRecords(),
  broken: brokenLinks(),
  outOfStep: fatesOutOfStep(),
  unreconciled: baselineUnreconciled(),
  intrusions: specIntrusions(),
  swollen: seriesBeyondTwo(),
  unread: unreadReports(),
  takenOutNamed: namesOfTakenOut(),
  retired: retiredWordsWritten(),
  commandKinds: kindsOfCommands(),
  unreadExports: exportsNoHostReads(),
  testsOffTheirSection: testsOffTheirSection(),
  commentsNoMarks: commentsThatAreNoMarks(),
  sharedNames: namesSharedInTree(repoRoot)
});
process.stdout.write(text);
process.exit(failed ? 1 : 0);

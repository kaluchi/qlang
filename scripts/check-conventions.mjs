#!/usr/bin/env node
// Mechanise the rules of the aim and of the work that a pass over the
// tree can hold [QSAIM#principles], [QSWRK#tooling]: the checks catch the
// plain breaches, so a review reads for the deep ones, the habits words
// wake, the completeness of a concept, a half measure.
//
// Checks:
//
//   (1) Forbidden temporal framing / placeholder markers.
//       `TODO`, `FIXME`, `HACK`, `legacy`, `deprecated`,
//       `currently`, `previously`, `for backward compatibility`,
//       `backwards compat`. Scanned in .mjs / .js source. The
//       common English words `now` / `was` / `old` / `new` live
//       in CLAUDE.md's forbidden list too but carry too many
//       legitimate uses (`new Map()` constructor, `was X still Y`
//       as part of a legitimate reference, etc.) for a cheap
//       grep — those stay under human review.
//
//   (3) A refusal is declared by its address. Every factory of a
//       refusal and every recording of a site takes the address as a
//       literal, `'noun/LastNameError'`, and the constant that holds
//       the class is the address without its slash, across `core/src`,
//       `cli/src`, `lsp/src` [QSERR#site].
//
//   (4) Derivable tallies in markdown prose. A count that
//       `npm test`, the manifest, or a grep already answers —
//       conformance cases, error classes, operands, catalog
//       families, files — drifts the moment the next commit
//       lands. Prose states the invariant, the generator states
//       the number. Scanned outside fenced blocks and inline
//       code spans so example values stay legal.
//
//   (5) Internal workspace dependency ranges. npm workspaces link
//       a sibling by name, so a stale range steers nothing locally
//       and surfaces only in the registry, where a consumer
//       resolves it for real. Every declaration naming a sibling
//       workspace — in any dependency map — must read
//       `^<that workspace's version>`.
//
//   (6) Anchors of the texts that hold the work: a path the
//       instruction file, the chapter of the aim or the chapter of
//       the work names exists, and words they
//       quote from the tree, “…” beside the path of their file, stand
//       in that file. A path under a folder the repository lacks is the
//       sister project's, checked where its checkout sits beside this
//       one.
//
//   (8) Who decided: a record from D155 on names in a line of its
//       own, `Decided by.`, the maintainer or the model [QSWRK#journal].
//
//   (9) The walk of a baseline: a record of the language the
//       baseline holds is held by a case or closed by the line of its
//       fate, no more than twenty records wait for the next walk, and the code, the tests and the cases cite the records in
//       force, the documents that hold the work those in force or
//       waiting on a target [QSWRK#baseline]; a section of a chapter is
//       written since the baseline by a record dissolved into it [D300].
//
//   (10) A series keeps its two latest: the sets of the benchmark, its
//       screens, the runs of the references and the outside audits
//       [QSWRK#measure], [QSWRK#review].
//
// Exit 0 when every check passes, 1 when any violation surfaces.
// Run via `npm run check:conventions` from the repo root.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { readWorkspaces, siblingDeclarations } from './workspace-manifests.mjs';
import { walkOfBaseline } from './baseline-walk.mjs';
import { marksOfTree } from './marks.mjs';
import { DECIDED_RECORD_FIELDS, OPEN_RECORD_FIELDS, isOpenText, readDecisionRecords, replacedWhole, statementsOf, JOURNAL, REPLACED, RESEARCH } from './decision-records.mjs';
import { execFileSync } from 'node:child_process';

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
// A report a reviewer or an outside auditor wrote, named by its date,
// stands as it was written, and the README of its folder is checked.
const VERBATIM_REPORT = new RegExp(`^${RESEARCH}/(reviews|outside-audit)/\\d{4}-\\d{2}-\\d{2}[^/]*\\.md$`);
// Files that quote the forbidden list verbatim — exempt from the
// forbidden-word scan, still in scope for every other check.
const RULESET_FILES = new Set([
  'CLAUDE.md',
  'scripts/check-conventions.mjs'  // this file quotes the list
]);

const FORBIDDEN_PATTERNS = [
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

function* walkSourceTree(rootDir) {
  for (const entry of readdirSync(rootDir)) {
    const entryPath = join(rootDir, entry);
    const entryStat = statSync(entryPath);
    const relPath = relative(repoRoot, entryPath).split(sep).join('/');

    if (entryStat.isDirectory()) {
      if (IGNORE_DIRS.has(relPath) || IGNORE_DIRS.has(entry)) continue;
      // A directory with a `.git` of its own is another checkout, such
      // as the worktree an editor or an agent keeps inside the tree.
      if (existsSync(join(entryPath, '.git'))) continue;
      yield* walkSourceTree(entryPath);
      continue;
    }
    if (!/\.(mjs|js|md|qlang)$/.test(entry) || VERBATIM_REPORT.test(relPath)) continue;
    yield entryPath;
  }
}

function scanForbiddenWords() {
  const violations = [];
  for (const filePath of walkSourceTree(repoRoot)) {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    // The docs/ tree names forbidden words for pedagogy, and the
    // ruleset files quote the list itself — both are allowed to
    // spell the words out.
    if (RULESET_FILES.has(relFile)) continue;
    if (relFile.startsWith('docs/')) continue;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const { rule, regex } of FORBIDDEN_PATTERNS) {
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

// ── (3) A refusal is declared by its address ──────────────────
//
// A refusal's address is the one key the implementation and its page in the
// catalog share: every declaration of a refusal and every recording of an
// address outside one takes it as a literal, the path of the place that
// refused and a last name ending in `Error`, `vec/sum/ElementNotNumberError`,
// and the constant that holds the class is named by the address without its
// slashes, `VecSumElementNotNumberError`, so a grep for either finds the
// declaration, every throw and the page [QSERR#site]. A class declared by
// `class Foo extends …` ends in `Error`; the abstract roots are the bases
// every site extends.

const ABSTRACT_BASES = new Set(['QlangError', 'QlangInvariantError']);

const refusalDeclarationRe = /(?:\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*)?\b(declareRefusal|declare\w*Error|recordRefusal)\(\s*([^,)]*)/g;
const directClassRe = /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+(?:Qlang[A-Za-z]*Error|Error)\b/g;
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

function refusalDeclarationDrift() {
  const violations = [];
  for (const filePath of walkRefusalScanRoots()) {
    const text = readFileSync(filePath, 'utf8');
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    const lineAt = index => text.slice(0, index).split('\n').length;
    for (const match of text.matchAll(refusalDeclarationRe)) {
      const [, constant, factory, argument] = match;
      if (FACTORY_DEFINITION_FILES.has(relFile) && /^[a-z]\w*$/.test(argument.trim())) continue;
      const address = ADDRESS_RE.exec(argument.trim())?.[1];
      const line = lineAt(match.index);
      if (address === undefined) {
        violations.push({ file: relFile, line, problem: `${factory} takes ${argument.trim() || 'nothing'}, where a refusal's address stands, \`'noun/LastNameError'\`` });
      } else if (constant !== undefined && constant !== constantOfAddress(address)) {
        violations.push({ file: relFile, line, problem: `${constant} holds ${address}, which names it ${constantOfAddress(address)}` });
      }
    }
    for (const match of text.matchAll(directClassRe)) {
      if (ABSTRACT_BASES.has(match[1]) || match[1].endsWith('Error')) continue;
      violations.push({ file: relFile, line: lineAt(match.index), problem: `class ${match[1]} names a refusal without the suffix Error` });
    }
  }
  return violations;
}

// ── (4) Derivable tallies in markdown prose ────────────────────
//
// The nouns whose counts a test run, the manifest, or a grep
// already answers. A digit standing in front of one of them in
// prose is a number the next commit invalidates in silence.

const TALLY_NOUNS = [
  'conformance', 'cases?', 'tests?', 'suites?', 'operands?',
  'error classes', 'classes', 'famil(?:y|ies)', 'workspaces?',
  'files?', 'entries', 'lines?', 'primitives?', 'catalogs?'
].join('|');

// Up to two adjectives may sit between the digit and the noun
// («1192 error-producing conformance cases»). A digit carrying a
// section sigil (`§3 rule`, `#4 case`) addresses a chapter rather
// than counting one, and stays legal.
const TALLY_RE = new RegExp(
  String.raw`(?<![§#])\b\d[\d,]*\s+(?:[a-z][a-z-]*\s+){0,2}(?:` + TALLY_NOUNS + String.raw`)\b`,
  'i');

const FENCE_RE = /^\s*```/;
const INLINE_CODE_RE = /`[^`]*`/g;

function scanProseTallies() {
  const violations = [];
  for (const filePath of walkSourceTree(repoRoot)) {
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    if (!relFile.endsWith('.md')) continue;

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
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

// ── (5) Internal workspace dependency ranges ───────────────────
//
// `workspace-manifests.mjs` owns the rule: which dependency maps
// count and what range a sibling declaration carries. The release
// script rewrites against that module; this check enforces it, so a
// range that drifts between releases fails here rather than in the
// registry, where a consumer resolves it for real.

function workspaceRangeDrift() {
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

// ── (6) Anchors of the texts that hold the work ────────────────

const ANCHOR_DOCUMENTS = ['CLAUDE.md', 'docs/spec/QSAIM-the-aim.md', 'docs/spec/QSWRK-the-work.md'];
const ANCHOR_PATH_RE = /`((?:core|cli|lsp|site|vscode|scripts|docs|\.claude|\.github)\/[\w./@-]+\.(?:mjs|js|qlang|peggy|md|json|jsonl|yml|astro|txt))`/g;
const TREE_QUOTE_RE = /“([^”]+)”\s*\(`([^`]+)`/g;
const sisterRoot = join(repoRoot, '..', 'eclipse-jdt-search');

// The checkout that holds a path: this one when its folder is here, the
// sister project's where it sits beside this one, and none otherwise.
function anchorRootOf(anchorPath) {
  const folder = anchorPath.split('/').slice(0, -1).join('/');
  if (existsSync(join(repoRoot, folder))) return repoRoot;
  return existsSync(sisterRoot) ? sisterRoot : null;
}

function anchorDrift() {
  const violations = [];
  for (const documentPath of ANCHOR_DOCUMENTS) {
    const text = readFileSync(join(repoRoot, documentPath), 'utf8');
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
      const anchored = readFileSync(join(root, anchorPath), 'utf8').replace(/\s+/g, ' ');
      if (!anchored.includes(quoted.trim())) {
        violations.push({ file: documentPath, anchor: anchorPath, problem: `quotes “${quoted}”, which the file no longer holds` });
      }
    }
  }
  return violations;
}

// ── (7) Decisions kept out of the catalog ──────────────────────
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
// reads: it marks the decisions the source exists for [QSWRK#marks].
function decisionsInCatalog() {
  const violations = [];
  for (const file of CATALOG_ROOTS.flatMap(catalogFiles)) {
    const lines = readFileSync(join(repoRoot, file), 'utf8').split(/\r?\n/);
    const headEnd = lines[0]?.startsWith('|~') && !lines[0].startsWith('|~~') ? lines.findIndex(line => line.includes('~|')) : -1;
    lines.forEach((line, index) => {
      if (index <= headEnd) return;
      const reference = line.match(/\[D\d+\]/);
      if (reference) violations.push({ file: file.replace(/\\/g, '/'), line: index + 1, reference: reference[0] });
    });
  }
  return violations;
}

// ── (8) Who decided ────────────────────────────────────────────
//
// A record names who took its decision, so a session tells the
// maintainer's words, which bind it, from the model's reading, which it
// weighs on its merits [QSWRK#journal]; an open record names none until it is
// decided, and holds its question, its source and its alternatives
// [QSWRK#journal].

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
    .filter(({ file }) => outOfForm(readFileSync(join(repoRoot, file), 'utf8')))
    .map(({ file }) => file));
}

// ── (8b) The folders of the records ────────────────────────────
//
// The root of the records holds those in force, and `replaced/` those
// replaced whole, each moved there once by `scripts/replaced-records.mjs`
// [QSWRK#journal].

function misplacedRecords() {
  const replacedWhole = path => /^(Replaced by|Merged into|Dissolved into) /m.test(readFileSync(join(repoRoot, path), 'utf8'));
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

function baselineDrift() {
  return walkOfBaseline(repoRoot).violations;
}

// ── (9b) The links of the documents ────────────────────────────
//
// A link of a document to a file of markdown, its definition `[Dnn]:
// Dnn.md` or its inline form, leads to a file the tree holds, so the graph
// of the records walks from any document into the past [QSWRK#journal], [QSWRK#marks].

const MARKDOWN_LINK = /(?:\]:[ \t]*|\]\()([^)\s]+\.md)(?=[)\s#]|$)/gm;

function brokenLinks() {
  const violations = [];
  const documents = execFileSync('git', ['ls-files', '*.md'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const path of documents) {
    const text = readFileSync(join(repoRoot, path), 'utf8');
    for (const match of text.matchAll(MARKDOWN_LINK)) {
      const target = match[1];
      if (/^[a-z]+:/i.test(target) || target.startsWith('/')) continue;
      if (existsSync(join(repoRoot, dirname(path), target))) continue;
      violations.push({ path, line: text.slice(0, match.index).split('\n').length, target });
    }
  }
  return violations;
}

// ── (9c) The fates of the records ──────────────────────────────
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
  const statementsOfRecord = new Map([...records].map(([name, record]) => [name, statementsOf(readFileSync(record.path, 'utf8')).map(statement => statement.text)]));
  const fatesOf = name => statementsOfRecord.get(name).filter(statement => /^(Replaced by|Merged into|Pruned of what) /.test(statement));
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

// ── (10) The marks of the artifacts ────────────────────────────
//
// Every module, script, test file, source of qlang and workflow names
// the decision it exists for, so the scope of a decision is found by its
// marks and an artifact no decision explains is seen [QSWRK#marks].

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
    readFileSync(join(specDir, name), 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (line.startsWith('```')) { fenced = !fenced; return; }
      if (fenced) return;
      for (const { rule, regex, besides } of SPEC_INTRUSIONS) {
        if (besides !== undefined && name.startsWith(besides)) continue;
        const match = regex.exec(line);
        if (match) found.push({ file: `docs/spec/${name}`, line: index + 1, rule, text: match[0] });
      }
    });
  }
  for (const seed of ['CLAUDE.md', 'README.md', 'core/README.md', 'cli/README.md']) {
    readFileSync(join(repoRoot, seed), 'utf8').split(/\r?\n/).forEach((line, index) => {
      const match = HISTORY_DATE.exec(line);
      if (match) found.push({ file: seed, line: index + 1, rule: 'a date of the history', text: match[0] });
    });
  }
  return found;
}

function unmarkedArtifacts() {
  return marksOfTree(repoRoot).orphans;
}

// ── (10) A series keeps its two latest ─────────────────────────
//
// The sets of the benchmark with their runs, the screens, the runs of the
// references and the outside audits keep their two latest, and an older
// one goes to the history [QSWRK#measure], [QSWRK#review].

const SERIES = [
  { name: 'the sets of the benchmark', members: paths => new Set(paths.filter(path => path.startsWith('scripts/benchmark/sets/')).map(path => path.split('/')[3])) },
  { name: 'the screens of the benchmark', members: paths => paths.filter(path => path.startsWith('scripts/benchmark/screens/')) },
  { name: 'the runs of the references', members: paths => paths.filter(path => path.startsWith('scripts/benchmark/runs/')) },
  { name: 'the outside audits', members: paths => paths.filter(path => new RegExp(`^${RESEARCH}/outside-audit/\\d{4}-\\d{2}-\\d{2}-[0-9a-f]+\\.md$`).test(path)) },
];

function seriesBeyondTwo() {
  const paths = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
  return SERIES.map(({ name, members }) => ({ name, count: [...members(paths)].length })).filter(({ count }) => count > 2);
}

// ── Main ───────────────────────────────────────────────────────

const forbidden = scanForbiddenWords();
const refusalDeclarations = refusalDeclarationDrift();
const proseTallies = scanProseTallies();
const workspaceRanges = workspaceRangeDrift();
const anchors = anchorDrift();
const catalogDecisions = decisionsInCatalog();
const undecided = recordsWithoutDecider();
const unwalked = baselineDrift();
const unmarked = unmarkedArtifacts();
const misplaced = misplacedRecords();
const broken = brokenLinks();
const outOfStep = fatesOutOfStep();
const intrusions = specIntrusions();
const swollen = seriesBeyondTwo();

if (forbidden.length === 0
    && refusalDeclarations.length === 0
    && proseTallies.length === 0
    && workspaceRanges.length === 0
    && anchors.length === 0
    && catalogDecisions.length === 0
    && undecided.length === 0
    && unwalked.length === 0
    && unmarked.length === 0
    && misplaced.length === 0
    && broken.length === 0
    && outOfStep.length === 0
    && intrusions.length === 0
    && swollen.length === 0) {
  process.stdout.write('check:conventions — OK\n');
  process.exit(0);
}

if (forbidden.length > 0) {
  process.stdout.write(`\nForbidden framing / markers (${forbidden.length}):\n`);
  for (const v of forbidden) {
    process.stdout.write(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}\n`);
  }
  process.stdout.write('    a text says what holds, not when it changed, and leaves no marker of work undone [QSWRK#tooling].\n');
}
if (refusalDeclarations.length > 0) {
  process.stdout.write(`\nRefusals not declared by their address (${refusalDeclarations.length}):\n`);
  for (const v of refusalDeclarations) process.stdout.write(`  ${v.file}:${v.line}  ${v.problem}\n`);
  process.stdout.write('    the address is the key the implementation and the page of the catalog share [QSERR#site].\n');
}
if (proseTallies.length > 0) {
  process.stdout.write(
    `\nDerivable tallies in prose (${proseTallies.length}):\n`);
  for (const v of proseTallies) {
    process.stdout.write(`  ${v.file}:${v.line}  [tally: '${v.tally}']  ${v.snippet}\n`);
    process.stdout.write('    state the invariant and name the generator (npm test / the manifest / the catalog) — the number belongs to the run, not to the prose [QSWRK#tooling].\n');
  }
}
if (workspaceRanges.length > 0) {
  process.stdout.write(
    `\nInternal workspace dependency ranges (${workspaceRanges.length}):\n`);
  for (const v of workspaceRanges) {
    process.stdout.write(`  ${v.file}  ${v.dependencyMap}.${v.depName}: '${v.declaredRange}' — expected '${v.expectedRange}'\n`);
    process.stdout.write('    the published manifest carries this range verbatim; name the sibling version this release ships with so a consumer resolves one core instance, not two [QSWRK#tooling].\n');
  }
}
if (anchors.length > 0) {
  process.stdout.write(`\nAnchors the tree no longer holds (${anchors.length}):\n`);
  for (const v of anchors) {
    process.stdout.write(`  ${v.file}  \`${v.anchor}\` ${v.problem}\n`);
  }
  process.stdout.write('    replace the sentence with the fact of the tree and its new anchor [QSWRK#probe].\n');
}
if (catalogDecisions.length > 0) {
  process.stdout.write(`\nDecisions named in the catalog (${catalogDecisions.length}):\n`);
  for (const v of catalogDecisions) process.stdout.write(`  ${v.file}:${v.line}  ${v.reference}\n`);
  process.stdout.write('    a page names what a reader can follow by a query; the reason lives with its decision [QSWRK#marks].\n');
}
if (undecided.length > 0) {
  process.stdout.write(`\nRecords out of their form (${undecided.length}):\n`);
  for (const file of undecided) process.stdout.write(`  ${file}\n`);
  process.stdout.write('    a record opens with `Domain.`, the part of the work it governs; write `Decided by. The maintainer` or `Decided by. The model`, the line naming the parts of the model beside the choice of the maintainer [QSWRK#journal]; an open record holds `Question.`, `Source.` and `Alternatives.`, and no `Decided by.` or `Decision.` until it is decided [QSWRK#journal].\n');
}
if (unmarked.length > 0) {
  process.stdout.write(`\nArtifacts that name no decision (${unmarked.length}):\n`);
  for (const path of unmarked) process.stdout.write(`  ${path}\n`);
  process.stdout.write('    name the decision the artifact exists for at its head, or let it go [QSWRK#marks].\n');
}
if (misplaced.length > 0) {
  process.stdout.write(`\nRecords in the wrong folder (${misplaced.length}):\n`);
  for (const { path, problem } of misplaced) process.stdout.write(`  ${path}  ${problem}\n`);
  process.stdout.write('    the root of the records holds those in force, and `replaced/` those replaced whole, moved once [QSWRK#journal].\n');
}
if (broken.length > 0) {
  process.stdout.write(`\nLinks that lead nowhere (${broken.length}):\n`);
  for (const { path, line, target } of broken) process.stdout.write(`  ${path}:${line}  ${target}\n`);
  process.stdout.write('    a link of a document leads to a file the tree holds; `node scripts/replaced-records.mjs` writes the links to a record it moves [QSWRK#journal], [QSWRK#marks].\n');
}
if (outOfStep.length > 0) {
  process.stdout.write(`\nFates out of step (${outOfStep.length}):\n`);
  for (const { name, problem } of outOfStep) process.stdout.write(`  ${name}  ${problem}\n`);
  process.stdout.write('    a line of fate names a record the folder holds, a part taken is named back by the record that took it, and a record is pruned only by one written after it [QSWRK#journal].\n');
}
if (unwalked.length > 0) {
  process.stdout.write(`\nThe walk of the baseline (${unwalked.length}):\n`);
  for (const v of unwalked) process.stdout.write(`  ${v.where}  ${v.problem}\n`);
  process.stdout.write('    give each record its fate or its case, move the baseline, and cite the records in force [QSWRK#baseline].\n');
}
if (intrusions.length > 0) {
  process.stdout.write(`\nA text that states what holds speaks of the change (${intrusions.length}):\n`);
  for (const v of intrusions) process.stdout.write(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text}\n`);
  process.stdout.write('    a cataphatic text states what holds; the change, its records and its history belong to the journal [QSWRK#spec], [QSWRK#documents].\n');
}
if (swollen.length > 0) {
  process.stdout.write(`\nSeries past their two latest (${swollen.length}):\n`);
  for (const { name, count } of swollen) process.stdout.write(`  ${name}: ${count}\n`);
  process.stdout.write('    a series keeps its two latest, and an older one goes to the history, git keeping it [QSWRK#measure], [QSWRK#review].\n');
}
process.exit(1);

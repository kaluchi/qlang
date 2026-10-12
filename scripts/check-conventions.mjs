#!/usr/bin/env node
// Mechanise the subset of CLAUDE.md review rules that a grep pass
// can enforce. The qlang-review agent (`.claude/agents/qlang-
// review.md`) is the authoritative rule set — the checks here are
// a pre-commit safety net for the rules with low false-positive
// rate: they catch obvious violations so the human review can
// focus on the deep ones (lexicon entropy, concept completeness,
// half-measures).
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
//       `cli/src`, `lsp/src` [D158], [D159].
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
//   (6) Anchors of the documents that hold the work: a path the
//       audit, the entrypoint document or the instruction file names
//       exists, and words they quote from the tree, “…” beside the
//       path of their file, stand in that file. A path under a folder
//       the repository lacks is the sister project's, checked where
//       its checkout sits beside this one.
//
//   (8) Who decided: a record from D155 on names in a line of its
//       own, `Decided by.`, the maintainer or the model [D155].
//
//   (9) The walk of a baseline: a record of the language the audit's
//       baseline holds is held by a case or closed by the line of its
//       fate, no more than a working day of records waits for the next
//       walk, and the code, the tests and the cases cite the records in
//       force, the documents that hold the work those in force or
//       waiting on a target [D225], [D226].
//
// Exit 0 when every check passes, 1 when any violation surfaces.
// Run via `npm run check:conventions` from the repo root.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { readWorkspaces, siblingDeclarations } from './workspace-manifests.mjs';
import { readDecisionRecords, replacedWhole, isBeingDecided, isHeld } from './decision-records.mjs';

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
  'scripts/benchmark/sets',  // the data and the generators clean authors wrote [D142]
  'vscode'
]);
// A report a reviewer or an outside auditor wrote, named by its date,
// stands as it was written, and its ledger beside it is checked.
const VERBATIM_REPORT = /^docs\/research\/(reviews|outside-audit)\/\d{4}-\d{2}-\d{2}[^/]*\.md$/;
// Files that quote the forbidden list verbatim — exempt from the
// forbidden-word scan, still in scope for every other check.
const RULESET_FILES = new Set([
  'CLAUDE.md',
  '.claude/agents/qlang-review.md',
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
// A refusal's address is the one key the implementation and its page
// in the catalog share [D158]: every declaration of a refusal and every
// recording of an address outside one takes it as a literal, the path of
// the place that refused, a marked name such as `@out` among its names,
// and a last name ending in `Error`, `vec/sum/ElementNotNumberError`, and
// the constant that holds the class is named by the address without its
// slashes and marks, `VecSumElementNotNumberError`, so a grep for either
// finds the declaration, every throw and the page [D159]. A class declared by
// `class Foo extends …` ends in `Error`; the abstract roots are the
// bases every site extends.

const ABSTRACT_BASES = new Set(['QlangError', 'QlangInvariantError']);

const refusalDeclarationRe = /(?:\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*)?\b(declareRefusal|declare\w*Error|recordRefusal)\(\s*([^,)]*)/g;
const directClassRe = /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+(?:Qlang[A-Za-z]*Error|Error)\b/g;
const ADDRESS_RE = /^'((?:@?[a-z][A-Za-z0-9]*\/)+[A-Z][A-Za-z0-9]*Error)'$/;
const FACTORY_DEFINITION_FILES = new Set(['core/src/errors.mjs']);

// The constant a refusal's class is held by: its address without the
// slash, each name capitalised and the effect marker dropped.
function constantOfAddress(address) {
  return address.split('/').map(part => part.replace(/^@/, '')).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
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

// ── (6) Anchors of the documents that hold the work ────────────

const ANCHOR_DOCUMENTS = ['docs/qlang-audit.md', 'docs/qlang-entrypoint.md', 'CLAUDE.md'];
const ANCHOR_PATH_RE = /`((?:core|cli|lsp|site|vscode|scripts|docs)\/[\w./@-]+\.(?:mjs|js|qlang|peggy|md|json|jsonl|yml|astro))`/g;
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
// nowhere, and the reason of a sentence lives with its decision [D225].

const CATALOG_ROOTS = ['core/lib', 'cli/lib'];

function catalogFiles(dir) {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? catalogFiles(join(dir, entry.name))
      : entry.name.endsWith('.qlang') ? [join(dir, entry.name)] : []);
}

function decisionsInCatalog() {
  const violations = [];
  for (const file of CATALOG_ROOTS.flatMap(catalogFiles)) {
    readFileSync(join(repoRoot, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
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
// weighs on its merits [D155].

const FIRST_RECORD_NAMING_ITS_DECIDER = 155;
const DECIDER_LINE = /^Decided by\. The (maintainer|model)\b/m;

function recordsWithoutDecider() {
  const recordsDir = join(repoRoot, 'docs', 'decisions');
  return readdirSync(recordsDir)
    .map(file => ({ file, number: Number(/^D(\d+)\.md$/.exec(file)?.[1]) }))
    .filter(({ number }) => number >= FIRST_RECORD_NAMING_ITS_DECIDER)
    .filter(({ file }) => !DECIDER_LINE.test(readFileSync(join(recordsDir, file), 'utf8')))
    .map(({ file }) => `docs/decisions/${file}`);
}

// ── (9) The walk of a baseline ─────────────────────────────────
//
// The audit is held against a commit, its baseline. A record of the
// language that the baseline's tree holds is held by a case or closed by
// the line of its fate, and the records written since wait for the walk
// no longer than a working day of them; the code, the tests and the
// cases cite the records in force, and the documents that hold the work
// those in force or waiting on a target [D225], [D226].

const RECORDS_A_WALK_TAKES = 20;
const CITING_CODE_ROOTS = ['core/src', 'core/host', 'core/test/unit', 'cli/src', 'cli/test', 'lsp/src', 'lsp/test', 'vscode/src', 'vscode/test', 'site/src', 'scripts'];
const CITING_DOCUMENTS = ['docs/qlang-audit.md', 'docs/qlang-entrypoint.md', 'CLAUDE.md', '.claude/agents/qlang-review.md', 'README.md', 'core/README.md', 'cli/README.md', 'lsp/README.md', 'vscode/README.md', 'site/README.md'];
const CODE_FILE = /\.(mjs|js|ts|astro|peggy)$/;
const UNCITING_FOLDERS = new Set(['node_modules', 'gen', 'dist', '.astro', 'sets', 'runs']);
const CITATION = /\[((?:[DE]\d+)(?:,\s*[DE]\d+)*)\]|\bdecisions? ((?:[DE]\d+)(?:(?:,\s*| and )[DE]\d+)*)/g;

function filesUnder(dir, pattern) {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return UNCITING_FOLDERS.has(entry.name) ? [] : filesUnder(`${dir}/${entry.name}`, pattern);
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
  if (replacedWhole(record)) return `closed by ${record.replacedBy.join(', ')}`;
  return isBeingDecided(record) ? 'which no case holds' : 'which a target alone holds';
}

function baselineDrift() {
  const audit = readFileSync(join(repoRoot, 'docs', 'qlang-audit.md'), 'utf8').replace(/\s+/g, ' ');
  const baseline = /holds it against commit `([0-9a-f]+)`/.exec(audit)?.[1];
  if (baseline === undefined) return [{ where: 'docs/qlang-audit.md', problem: 'names no baseline commit' }];
  let listed;
  try {
    listed = execFileSync('git', ['ls-tree', '--name-only', baseline, 'docs/decisions/'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return [{ where: 'docs/qlang-audit.md', problem: `names the baseline ${baseline}, which the history lacks` }];
  }
  const atBaseline = new Set(listed.split('\n').map(path => /([DE]\d+)\.md$/.exec(path)?.[1]).filter(Boolean));
  const records = readDecisionRecords(repoRoot);
  const violations = [];
  for (const [name, record] of records) {
    if (atBaseline.has(name) && isBeingDecided(record)) {
      violations.push({ where: `docs/decisions/${name}.md`, problem: `outlived the baseline ${baseline}: no case names it and no line gives its fate` });
    }
  }
  const since = [...records.keys()].filter(name => !atBaseline.has(name));
  if (since.length > RECORDS_A_WALK_TAKES) {
    violations.push({ where: 'docs/qlang-audit.md', problem: `${since.length} records since the baseline ${baseline}, from ${since[0]}: the walk is due` });
  }
  const notClosed = record => !replacedWhole(record) && !isBeingDecided(record);
  for (const file of CITING_CODE_ROOTS.flatMap(root => filesUnder(root, CODE_FILE))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !isHeld(record)) violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
    }
  }
  for (const file of filesUnder('core/test/conformance', /\.jsonl$/)) {
    readFileSync(join(repoRoot, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (line.trim() === '' || line.trim().startsWith('//')) return;
      for (const name of [JSON.parse(line).decision ?? []].flat()) {
        const record = records.get(name);
        if (record !== undefined && !notClosed(record)) violations.push({ where: `${file}:${index + 1}`, problem: `names ${name}, ${stateOf(record)}` });
      }
    });
  }
  for (const file of CITING_DOCUMENTS.filter(path => existsSync(join(repoRoot, path)))) {
    for (const { name, line } of citationsIn(readFileSync(join(repoRoot, file), 'utf8'))) {
      const record = records.get(name);
      if (record !== undefined && !notClosed(record)) violations.push({ where: `${file}:${line}`, problem: `cites ${name}, ${stateOf(record)}` });
    }
  }
  return violations;
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

if (forbidden.length === 0
    && refusalDeclarations.length === 0
    && proseTallies.length === 0
    && workspaceRanges.length === 0
    && anchors.length === 0
    && catalogDecisions.length === 0
    && undecided.length === 0
    && unwalked.length === 0) {
  process.stdout.write('check:conventions — OK\n');
  process.exit(0);
}

if (forbidden.length > 0) {
  process.stdout.write(`\nForbidden framing / markers (${forbidden.length}):\n`);
  for (const v of forbidden) {
    process.stdout.write(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}\n`);
  }
}
if (refusalDeclarations.length > 0) {
  process.stdout.write(`\nRefusals not declared by their address (${refusalDeclarations.length}):\n`);
  for (const v of refusalDeclarations) process.stdout.write(`  ${v.file}:${v.line}  ${v.problem}\n`);
  process.stdout.write('    the address is the key the implementation and the page of the catalog share [D158], [D159].\n');
}
if (proseTallies.length > 0) {
  process.stdout.write(
    `\nDerivable tallies in prose (${proseTallies.length}):\n`);
  for (const v of proseTallies) {
    process.stdout.write(`  ${v.file}:${v.line}  [tally: '${v.tally}']  ${v.snippet}\n`);
    process.stdout.write('    state the invariant and name the generator (npm test / the manifest / the catalog) — the number belongs to the run, not to the prose.\n');
  }
}
if (workspaceRanges.length > 0) {
  process.stdout.write(
    `\nInternal workspace dependency ranges (${workspaceRanges.length}):\n`);
  for (const v of workspaceRanges) {
    process.stdout.write(`  ${v.file}  ${v.dependencyMap}.${v.depName}: '${v.declaredRange}' — expected '${v.expectedRange}'\n`);
    process.stdout.write('    the published manifest carries this range verbatim; name the sibling version this release ships with so a consumer resolves one core instance, not two.\n');
  }
}
if (anchors.length > 0) {
  process.stdout.write(`\nAnchors the tree no longer holds (${anchors.length}):\n`);
  for (const v of anchors) {
    process.stdout.write(`  ${v.file}  \`${v.anchor}\` ${v.problem}\n`);
  }
  process.stdout.write('    replace the sentence with the fact of the tree and its new anchor [D89].\n');
}
if (catalogDecisions.length > 0) {
  process.stdout.write(`\nDecisions named in the catalog (${catalogDecisions.length}):\n`);
  for (const v of catalogDecisions) process.stdout.write(`  ${v.file}:${v.line}  ${v.reference}\n`);
  process.stdout.write('    a page names what a reader can follow by a query; the reason lives with its decision [D225].\n');
}
if (undecided.length > 0) {
  process.stdout.write(`\nRecords that name no decider (${undecided.length}):\n`);
  for (const file of undecided) process.stdout.write(`  ${file}\n`);
  process.stdout.write('    write `Decided by. The maintainer` or `Decided by. The model`, a choice and the mechanics around it as two records [D155].\n');
}
if (unwalked.length > 0) {
  process.stdout.write(`\nThe walk of the baseline (${unwalked.length}):\n`);
  for (const v of unwalked) process.stdout.write(`  ${v.where}  ${v.problem}\n`);
  process.stdout.write('    give each record its fate or its case, move the baseline, and cite the records in force [D225], [D226].\n');
}
process.exit(1);

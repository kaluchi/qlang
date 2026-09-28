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
//   (3) Per-site error class `Error` suffix. Every concrete class
//       introduced by a `declare*Error(...)` factory call or by a
//       direct `class Foo extends QlangError` declaration across
//       `core/src`, `cli/src`, `lsp/src` must carry the `Error`
//       suffix, so the named-error island stays distinct from the
//       value-class tag-bindings (`::verb`, `::qlang`,
//       `::json`).
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
// Exit 0 when every check passes, 1 when any violation surfaces.
// Run via `npm run check:conventions` from the repo root.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { readWorkspaces, siblingDeclarations } from './workspace-manifests.mjs';

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
  'vscode'
]);
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
    if (!/\.(mjs|js|md|qlang)$/.test(entry)) continue;
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

// ── (3) Per-site error class `Error` suffix convention ─────────
//
// Every concrete error class in `core/src/**/*.mjs` must carry the
// `Error` suffix — the convention that distinguishes named-error
// tag-bindings (`::FooError`) from value-class tag-bindings
// (`::verb`, `::qlang`, `::json`). Classes are introduced two
// ways:
//
//   * `declare(Subject|Modifier|Element|Comparability|Shape|Arity)
//     Error('Foo', …)` factory call — the first string literal
//     is the className.
//   * `class Foo extends QlangError|QlangInvariantError|ArityError|
//     EffectLaunderingError|Error` direct declaration.
//
// Abstract roots are exempt — they ARE the bases everyone extends,
// not concrete throw sites:

const ABSTRACT_BASES = new Set([
  'QlangError', 'QlangTypeError', 'QlangInvariantError',
  'ArityError', 'EffectLaunderingError'
]);

const factoryDeclRe = /declare(?:Subject|Modifier|Element|Comparability|Shape|Arity)Error\(\s*'([A-Z][A-Za-z0-9_]*)'/g;
const directClassRe = /class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s+(?:Qlang[A-Za-z]*Error|ArityError|EffectLaunderingError|Error)\b/g;

// Every workspace that can declare its own host-bound errors
// (CLI host operands via `declareSubjectError(...)` / direct
// `class FooError extends QlangError`, LSP server-side errors,
// future host packages) goes through the same scan. Scope sits
// at the npm-workspace boundary so a new workspace opt's into
// the convention by adding its `<ws>/src` here.
const ERROR_SUFFIX_SCAN_ROOTS = [
  ['core', 'src'],
  ['cli',  'src'],
  ['lsp',  'src']
];

function* walkErrorScanRoots() {
  for (const segments of ERROR_SUFFIX_SCAN_ROOTS) {
    const root = join(repoRoot, ...segments);
    let st;
    try { st = statSync(root); } catch { continue; }
    if (!st.isDirectory()) continue;
    yield* walkSourceTree(root);
  }
}

function errorSuffixDrift() {
  const violations = [];
  for (const filePath of walkErrorScanRoots()) {
    const text = readFileSync(filePath, 'utf8');
    const relFile = relative(repoRoot, filePath).split(sep).join('/');
    const lines = text.split(/\r?\n/);

    // Collect per-line classNames declared via factory or class
    // syntax so the violation report cites the exact line.
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];

      factoryDeclRe.lastIndex = 0;
      let fm;
      while ((fm = factoryDeclRe.exec(line)) !== null) {
        const className = fm[1];
        if (className.endsWith('Error')) continue;
        violations.push({
          file: relFile, line: lineIndex + 1,
          className, kind: 'factory call',
          snippet: line.trim().slice(0, 120)
        });
      }

      directClassRe.lastIndex = 0;
      let cm;
      while ((cm = directClassRe.exec(line)) !== null) {
        const className = cm[1];
        if (ABSTRACT_BASES.has(className)) continue;
        if (className.endsWith('Error')) continue;
        violations.push({
          file: relFile, line: lineIndex + 1,
          className, kind: 'class declaration',
          snippet: line.trim().slice(0, 120)
        });
      }
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
// nowhere, and the reason of a sentence lives with its decision [D110].

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

// ── Main ───────────────────────────────────────────────────────

const forbidden = scanForbiddenWords();
const errorSuffixViolations = errorSuffixDrift();
const proseTallies = scanProseTallies();
const workspaceRanges = workspaceRangeDrift();
const anchors = anchorDrift();
const catalogDecisions = decisionsInCatalog();

if (forbidden.length === 0
    && errorSuffixViolations.length === 0
    && proseTallies.length === 0
    && workspaceRanges.length === 0
    && anchors.length === 0
    && catalogDecisions.length === 0) {
  process.stdout.write('check:conventions — OK\n');
  process.exit(0);
}

if (forbidden.length > 0) {
  process.stdout.write(`\nForbidden framing / markers (${forbidden.length}):\n`);
  for (const v of forbidden) {
    process.stdout.write(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}\n`);
  }
}
if (errorSuffixViolations.length > 0) {
  process.stdout.write(
    `\nError-class \`Error\` suffix convention (${errorSuffixViolations.length}):\n`);
  for (const v of errorSuffixViolations) {
    process.stdout.write(`  ${v.file}:${v.line}  [${v.kind}: '${v.className}']  ${v.snippet}\n`);
    process.stdout.write(`    rename to '${v.className}Error' so the catalog stays in the high-entropy ::FooError island, distinct from value-class tag-bindings (::verb / ::qlang / ::json).\n`);
  }
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
  process.stdout.write('    a page names what a reader can follow by a query; the reason lives with its decision [D110].\n');
}
process.exit(1);
